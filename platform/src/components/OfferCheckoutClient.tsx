'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Props {
  offerCode: string;
  offerTitle: string;
  priceCents: number | null;
  currency: string;
  initialCoupon?: string;
  initialRef?: string;
}

function formatBrl(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
}

export function OfferCheckoutClient({
  offerCode,
  offerTitle,
  priceCents,
  currency,
  initialCoupon = '',
  initialRef = '',
}: Props) {
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'google_pay' | 'apple_pay'>('pix');
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{
    orderCode: string;
    grossCents: number;
    discountCents: number;
    netPayableCents: number;
    checkoutUrl: string | null;
    pixCopyPaste: string | null;
    message: string;
  } | null>(null);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setOrderResult(null);
    try {
      const res = await fetch('/api/v1/checkout/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          offerCode,
          buyerEmail: email,
          paymentMethod,
          couponCode: couponCode.trim() || undefined,
          partnerLinkCode: initialRef || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        orderCode?: string;
        grossCents?: number;
        discountCents?: number;
        netPayableCents?: number;
        checkoutUrl?: string | null;
        pixCopyPaste?: string | null;
        message?: string;
      };
      if (!res.ok || !json.ok || !json.orderCode) {
        setErrorMsg(json.error || 'Não foi possível iniciar o pagamento.');
        return;
      }
      setOrderResult({
        orderCode: json.orderCode,
        grossCents: json.grossCents ?? 0,
        discountCents: json.discountCents ?? 0,
        netPayableCents: json.netPayableCents ?? 0,
        checkoutUrl: json.checkoutUrl ?? null,
        pixCopyPaste: json.pixCopyPaste ?? null,
        message: json.message || 'Pedido criado.',
      });
    } catch {
      setErrorMsg('Erro de conexão ao gerar pedido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-stack">
      <div className="info-box">
        <strong>Pagamento próprio e seguro via Mercado Pago:</strong> Pix (aprovação instantânea),
        Cartão de Crédito, Google Pay e Apple Pay. O acesso é liberado automaticamente na Área do
        Aluno após a confirmação do pagamento.
      </div>

      {priceCents ? (
        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--cm-navy)' }}>
          {formatBrl(priceCents, currency)}
        </p>
      ) : null}

      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {orderResult ? (
        <div className="alert-success form-stack" role="status">
          <strong>Pedido {orderResult.orderCode} gerado para {offerTitle}</strong>
          <span>
            Valor final: <strong>{formatBrl(orderResult.netPayableCents, currency)}</strong>
            {orderResult.discountCents > 0
              ? ` (desconto de cupom: ${formatBrl(orderResult.discountCents, currency)})`
              : ''}
          </span>
          <span>{orderResult.message}</span>
          {orderResult.pixCopyPaste ? (
            <div className="field-group">
              <label htmlFor="pix-code">Pix Copia e Cola</label>
              <input id="pix-code" readOnly className="field-input" value={orderResult.pixCopyPaste} />
            </div>
          ) : null}
          {orderResult.checkoutUrl ? (
            <a
              href={orderResult.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-btn"
            >
              Concluir pagamento no Mercado Pago →
            </a>
          ) : (
            <Link href="/app" className="pill-btn pill-btn-secondary">
              Ir para a Área do Aluno
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={handleCheckout} className="form-stack">
          <div className="field-group">
            <label htmlFor="checkout-email">Seu e-mail de acesso</label>
            <input
              id="checkout-email"
              type="email"
              required
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Use o e-mail que você usará na Área do Aluno"
            />
          </div>

          <div className="field-group">
            <label htmlFor="checkout-method">Forma de pagamento</label>
            <select
              id="checkout-method"
              className="field-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            >
              <option value="pix">Pix (liberação imediata · menor taxa)</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="google_pay">Google Pay</option>
              <option value="apple_pay">Apple Pay</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="checkout-coupon">Cupom de parceiro ou desconto (opcional)</label>
            <input
              id="checkout-coupon"
              type="text"
              className="field-input"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Digite o código se tiver um cupom"
            />
          </div>

          <button type="submit" className="pill-btn" disabled={busy}>
            {busy ? 'Gerando pagamento...' : 'Gerar pagamento seguro'}
          </button>
        </form>
      )}
    </div>
  );
}
