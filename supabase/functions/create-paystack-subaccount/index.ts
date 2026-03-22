import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// We explicitly tell TypeScript that 'req' is a web Request object
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { business_name, settlement_bank, account_number, percentage_charge } = await req.json()
    
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Server configuration error: Missing Paystack Secret Key")
    }

    const response = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        business_name,
        settlement_bank,
        account_number,
        percentage_charge
      })
    })

    const data = await response.json()

    if (!response.ok || !data.status) {
        throw new Error(data.message || "Paystack API Error")
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    // We explicitly tell TypeScript that 'e' is an Error object
    const error = e as Error;
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})