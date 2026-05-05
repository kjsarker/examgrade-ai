import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const getPlanFromPriceId = (priceId: string) => {
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
    if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium'
    return 'free'
  }

  const getPaperLimit = (plan: string) => {
    if (plan === 'pro') return 200
    if (plan === 'premium') return 500
    return 50
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const plan = session.metadata?.plan || 'free'
      if (userId) {
        await supabase.from('users').update({
          plan,
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
          papers_limit: getPaperLimit(plan),
          papers_used: 0,
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
      const userId = customer.metadata?.supabase_user_id
      const priceId = sub.items.data[0]?.price?.id
      const plan = getPlanFromPriceId(priceId)
      if (userId) {
        await supabase.from('users').update({
          plan,
          subscription_status: sub.status,
          papers_limit: getPaperLimit(plan),
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
      const userId = customer.metadata?.supabase_user_id
      if (userId) {
        await supabase.from('users').update({
          plan: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          papers_limit: 5,
          papers_used: 0,
        }).eq('id', userId)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | undefined
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
        const userId = customer.metadata?.supabase_user_id
        if (userId) {
          await supabase.from('users').update({ papers_used: 0 }).eq('id', userId)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
