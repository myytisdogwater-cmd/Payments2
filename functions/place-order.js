// functions/place-order.js
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { amount, purchase_order_id, purchase_order_name, return_url } = body;

    const KHALTI_API_URL = "https://a.khalti.com/api/v2/epayment/initiate/";
    const KHALTI_SECRET_KEY = "Key 1234567890abcdef1234567890abcdef"; 

    // Safely extract the base domain without using .split() matching
    const baseOrigin = new URL(return_url).origin;

    const payload = {
      return_url: return_url,
      website_url: baseOrigin,
      amount: Math.round(amount * 100), // Convert NPR total to Paisa
      purchase_order_id: purchase_order_id,
      purchase_order_name: purchase_order_name || "UNICO Order Check",
      customer_info: {
        name: "Test Customer",
        email: "test@example.com",
        phone: "9800000000"
      }
    };

    const khaltiResponse = await fetch(KHALTI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await khaltiResponse.json();

    if (data.payment_url) {
      return new Response(JSON.stringify({ payment_url: data.payment_url }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "Khalti Initialization Failed", details: data }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// 🟢 GET REDIRECT HANDLER (Handles return callback verification)
export async function onRequestGet(context) {
  try {
    const { searchParams, origin } = new URL(context.request.url);
    const pidx = searchParams.get("pidx");
    const purchase_order_id = searchParams.get("purchase_order_id");
    const status = searchParams.get("status");

    // If Khalti parameters are missing entirely, bounce out
    if (!pidx) {
      return new Response("Missing payment tracking parameters.", { status: 400 });
    }

    // Check if user manually aborted the transaction panel
    if (status === "User canceled" || status === "Failed") {
      return Response.redirect(`${origin}/checkout.html?status=failed`);
    }

    // 1. Verify directly with Khalti's servers to prevent fraud injection
    const KHALTI_VERIFY_URL = "https://dev.khalti.com/api/v2/epayment/lookup/";
    const KHALTI_SECRET_KEY = "Key 1234567890abcdef1234567890abcdef"; 

    const verifyResponse = await fetch(KHALTI_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pidx })
    });

    const verificationData = await verifyResponse.json();

    // 2. If Khalti officially confirms the payment status is Completed
    if (verificationData.status === "Completed") {
      
      // 💡 SAFE GUARD: Only run database updates if context.env.DB is actually bound
      if (context.env && context.env.DB) {
        await context.env.DB.prepare(
          "UPDATE Payment SET paymentStatus = 'COMPLETED', khaltiPidx = ? WHERE id = ?"
        ).bind(pidx, purchase_order_id).run();
      }

      // Bounce back to checkout UI with parameters your DOM listener looks for
      return Response.redirect(`${origin}/checkout.html?status=success&method=khalti&pidx=${pidx}`);
    } else {
      return Response.redirect(`${origin}/checkout.html?status=failed`);
    }

  } catch (err) {
    return new Response(`Verification Engine Crash: ${err.message}`, { status: 500 });
  }
} // 💡 Fixed: Extra nested closing bracket removed cleanly!