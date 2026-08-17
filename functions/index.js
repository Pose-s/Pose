const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const Stripe = require("stripe");

// Inizializza admin solo se non è già presente
if (!admin.apps.length) {
  admin.initializeApp();
}

// 1. CREA SESSIONE STRIPE IDENTITY (Verifica Documento)
exports.createVerificationSession = onRequest({ secrets: ["STRIPE_SECRET_KEY"] }, (req, res) => {
  return cors(req, res, async () => {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      const session = await stripe.identity.verificationSessions.create({
        type: "document",
        metadata: { userId: userId },
        options: {
          document: {
            require_matching_selfie: true,
          },
        },
      });

      return res.status(200).json({ url: session.url, clientSecret: session.client_secret });
    } catch (error) {
      console.error("Error creating identity session:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// 2. CREA CHECKOUT ABBONAMENTO (10€/mese)
exports.createSubscriptionCheckout = onRequest({ secrets: ["STRIPE_SECRET_KEY"] }, (req, res) => {
  return cors(req, res, async () => {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const { userId, priceId, returnUrl } = req.body;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing parameters" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: { userId: userId },
        success_url: `${returnUrl}?verified_status=success`,
        cancel_url: `${returnUrl}?verified_status=cancelled`,
      });

      return res.status(200).json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// 3. WEBHOOK STRIPE (Riceve notifiche e aggiorna Firestore)
exports.stripeWebhook = onRequest({ secrets: ["STRIPE_SECRET_KEY"] }, async (req, res) => {
  const db = admin.firestore();
  const event = req.body;

  try {
    switch (event.type) {
      case "identity.verification_session.verified": {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          await db.collection("users").doc(userId).set(
            {
              isIdentityVerified: true,
              identityVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          await db.collection("users").doc(userId).set(
            {
              isVerified: true,
              badgeType: "crown",
              subscriptionId: session.subscription,
              verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const snapshot = await db.collection("users").where("subscriptionId", "==", subscription.id).get();

        const updates = snapshot.docs.map((doc) =>
          doc.ref.set(
            {
              isVerified: false,
              badgeType: null,
            },
            { merge: true }
          )
        );
        await Promise.all(updates);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});