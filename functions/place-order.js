// functions/place-order.js

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { amount, purchase_order_id, purchase_order_name, return_url } = body;

    const KHALTI_API_URL = "https://dev.khalti.com/api/v2/epayment/initiate/";
    
    // 🟢 FIXED: Khalti Sandbox requires a lowercase "key" prefix for testing authentication
    const KHALTI_SECRET_KEY = "key 05bf95cc57244045b8df5fad06748dab"; 

    const baseOrigin = new URL(return_url).origin;

    // Safety amount checker (Ensures total >= Rs. 10 to pass Khalti rules)
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
        "Authorization": KHALTI_SECRET_KEY, // 🟢 Passed cleanly using the lowercase key template
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
      console.error("Khalti Gateway Rejected Content:", data);
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

// 🟢 GET REDIRECT HANDLER
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
    const KHALTI_SECRET_KEY = "key 05bf95cc57244045b8df5fad06748dab"; // 🟢 Kept lowercase here too

    const verifyResponse = await fetch(KHALTI_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": KHALTI_SECRET_KEY,
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
