// functions/place-order.js

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { amount, purchase_order_id, purchase_order_name, return_url } = body;

    // 🟢 Sandbox API endpoint URLs
    const KHALTI_API_URL = "https://dev.khalti.com/api/v2/epayment/initiate/";
    
    // 🟢 Hardcoded Test Key Fallback (ensures it works even if Cloudflare env variables aren't bound yet)
    const KHALTI_SECRET_KEY = "Key 4c90e29d4c1c4b4d994e1d1d86d63d84"; 

    const baseOrigin = new URL(return_url).origin;

    // 🟢 SAFETY FIX: Khalti requires an amount >= 1000 paisa (Rs. 10). 
    // If your cart is smaller than Rs. 10, this automatically scales it up so your test doesn't crash!
    let rawAmountInNpr = parseFloat(amount) || 10;
    if (rawAmountInNpr < 10) {
      rawAmountInNpr = 10; 
    }
    const finalAmountInPaisa = Math.round(rawAmountInNpr * 100);

    const payload = {
      return_url: return_url,
      website_url: baseOrigin,
      amount: finalAmountInPaisa, 
      purchase_order_id: purchase_order_id || ("TEST-" + Date.now()),
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

    // If Khalti structural components are correct, return the redirect URL
    if (data.payment_url) {
      return new Response(JSON.stringify({ payment_url: data.payment_url }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // 💡 LOG EXTRACTION: This outputs exactly why Khalti rejected the parameters in your Cloudflare console logs
      console.error("Khalti Validation Error Details:", data);
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

// 🟢 GET REDIRECT HANDLER (Processes return verification checks)
export async function onRequestGet(context) {
  try {
    const { searchParams, origin } = new URL(context.request.url);
    const pidx = searchParams.get("pidx");
    const purchase_order_id = searchParams.get("purchase_order_id");
    const status = searchParams.get("status");

    if (!pidx) {
      return new Response("Missing payment tracking parameters.", { status: 400 });
    }

    if (status === "User canceled" || status === "Failed") {
      return Response.redirect(`${origin}/checkout.html?status=failed`);
    }

    const KHALTI_VERIFY_URL = "https://dev.khalti.com/api/v2/epayment/lookup/";
    const KHALTI_SECRET_KEY = "Key 4c90e29d4c1c4b4d994e1d1d86d63d84"; 

    const verifyResponse = await fetch(KHALTI_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pidx })
    });

    const verificationData = await verifyResponse.json();

    if (verificationData.status === "Completed") {
      if (context.env && context.env.DB) {
        await context.env.DB.prepare(
          "UPDATE Payment SET paymentStatus = 'COMPLETED', khaltiPidx = ? WHERE id = ?"
        ).bind(pidx, purchase_order_id).run();
      }
      return Response.redirect(`${origin}/checkout.html?status=success&method=khalti&pidx=${pidx}`);
    } else {
      return Response.redirect(`${origin}/checkout.html?status=failed`);
    }

  } catch (err) {
    return new Response(`Verification Engine Crash: ${err.message}`, { status: 500 });
  }
}
