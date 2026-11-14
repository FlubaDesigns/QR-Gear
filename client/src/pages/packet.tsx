import { DEFAULT_MEMBER_PROFIT_SHARE, formatProfitSharePercent } from "@shared/constants";
import { sortProductSizes } from "@shared/storefrontTypes";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, QrCode, ArrowLeft, ShoppingCart, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductProofApproval, ProductProofImages } from '@/features/shared/components/ProductProofApproval';

interface PublicPacketData {
  availableSizes?: string[];
  sizeUpcharges?: Record<string, number>;
  id: string;
  title: string;
  description: string;
  itemImage: string | null;
  retailPrice: number | null;
  productTitle: string;
  productImage: string | null;
  selectedColor: string | null;
  selectedShirtSize: string | null;
  qrType: string | null;
  memberId: string | null;
  status: string;
}

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function getQrTypeLabel(qrType: string | null): string {
  switch (qrType) {
    case 'qr-basic': return 'QR Basic';
    case 'qr-plus': return 'QR Plus';
    case 'qr-canvas': return 'QR Canvas';
    case 'qr-play': return 'QR Play';
    case 'qr-compose': return 'QR Compose';
    default: return 'QR Gear';
  }
}

function captureReferral() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('qrgear_referrer', ref);
    localStorage.setItem('qrgear_referrer_ts', new Date().toISOString());
  }
  return ref || localStorage.getItem('qrgear_referrer');
}

export default function PacketPage() {
  const [match, params] = useRoute("/p/:id");
  const packetId = params?.id;
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [approvedProofId, setApprovedProofId] = useState('');

  useEffect(() => {
    captureReferral();
  }, []);

  const { data, isLoading, error } = useQuery<{ success: boolean; packet: PublicPacketData }>({
    queryKey: ["/api/public/member-packet", packetId],
    enabled: !!packetId,
  });

  const { data: pricingData } = useQuery<{ sizeUpcharges?: Record<string, number> }>({
    queryKey: ["/api/pricing-settings"],
  });

  const packet = data?.packet;
  const proofQuery = useQuery<any>({ queryKey: ['/api/public/packet-proof', packetId, selectedSize], enabled: !!packet && !!selectedSize,
    queryFn: async () => {
      const response = await fetch('/api/public/packet-proof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packetId, selectedShirtSize: selectedSize }) });
      const proof = await response.json(); if (!response.ok) throw new Error(proof.error || 'Your proof could not load.'); return proof;
    }, retry: false });
  useEffect(() => setApprovedProofId(''), [packetId, selectedSize, proofQuery.data?.proofId]);
  const sizeUpcharges = packet?.sizeUpcharges || pricingData?.sizeUpcharges || {};
  const referrerId = localStorage.getItem('qrgear_referrer');

  useEffect(() => {
    if (packet && !selectedSize) setSelectedSize(packet.selectedShirtSize || packet.availableSizes?.[0] || 'M');
  }, [packet]);

  const basePrice = packet?.retailPrice || 0;
  const sizeUpcharge = sizeUpcharges[selectedSize] || 0;
  const totalPrice = Math.round((basePrice + sizeUpcharge) * 100) / 100;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setCheckoutError('');
      if (!proofQuery.data?.proofId || approvedProofId !== proofQuery.data.proofId) throw new Error('Approve your current product proof before continuing.');
      const response = await fetch('/api/public/packet-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packetId,
          selectedShirtSize: selectedSize,
          referrerId: referrerId || undefined,
          proofApproval: { approved: true, proofId: approvedProofId },
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create checkout');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      setCheckoutError(err.message);
    },
  });

  if (isLoading) {
    return (
      <>
        <section className="hero" aria-label="Loading product" aria-busy="true">
          <div className="row">
            <div className="layout__split-3-2 card product-detail">
              <Skeleton className="product-detail__loading-media" />
              <div className="detail__body">
                <Skeleton className="product-detail__loading-line" />
                <Skeleton className="product-detail__loading-controls" />
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!match || !packetId || error || !packet) {
    return (
      <>
        <section className="hero">
          <div className="row">
            <div className="layout__center card detail__body">
              <QrCode className="product-detail__icon" aria-hidden="true" />
              <h1 data-testid="text-not-found">Content Not Found</h1>
              <p>The product could not be loaded.</p>
              <Link href="/" className="btn btn-secondary" data-testid="button-go-home">
                <ArrowLeft className="product-detail__icon" aria-hidden="true" /> Go Home
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  const createYourOwnUrl = referrerId ? `/build?ref=${referrerId}` : '/build';

  return (
    <>
      <section className="hero" aria-labelledby="packet-title">
        <div className="row">
          <div className={`${packet.itemImage ? 'layout__split-3-2' : 'col-full'} card product-detail`}>
            {packet.itemImage && (
              <div className="product-detail__media">
                <img src={packet.itemImage} alt={packet.title} data-testid="img-packet-product" />
              </div>
            )}
            <div className="detail__body product-detail__body">
              {packet.qrType && (
                <span className="badge product-detail__badge" data-testid="badge-qr-type">
                  {getQrTypeLabel(packet.qrType)}
                </span>
              )}
              <h1 id="packet-title" data-testid="text-packet-title">{packet.title}</h1>
              {packet.description && <p data-testid="text-packet-description">{packet.description}</p>}
              {totalPrice > 0 && (
                <div className="flex-row wrap">
                  <strong className="product-detail__price" data-testid="text-packet-price">${totalPrice.toFixed(2)}</strong>
                  {sizeUpcharge > 0 && <small>(includes ${sizeUpcharge.toFixed(2)} size upcharge)</small>}
                </div>
              )}
              <div className="form-grid">
                <label htmlFor="packet-size">Size
                  <select id="packet-size" value={selectedSize} onChange={event => setSelectedSize(event.target.value)} data-testid="select-size">
                    <option value="" disabled>Select size</option>
                    {sortProductSizes(packet.availableSizes || AVAILABLE_SIZES).map(size => (
                      <option key={size} value={size} data-testid={`select-size-${size}`}>
                        {size}{(sizeUpcharges[size] || 0) > 0 ? ` (+$${(sizeUpcharges[size] || 0).toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {packet.selectedColor && <span data-testid="badge-color">{packet.selectedColor}</span>}
              </div>
              {checkoutError && <div className="alert alert-error" role="alert" data-testid="text-checkout-error">{checkoutError}</div>}
              {proofQuery.isFetching ? <p>Preparing your product proof…</p> : proofQuery.error ? <p role="alert">{proofQuery.error.message} <button className="btn btn-secondary" onClick={() => proofQuery.refetch()}>Retry proof</button></p> : proofQuery.data && <div className="space-y-3">
                <ProductProofImages proof={proofQuery.data} />
                <p>{proofQuery.data.selectedColor} · {proofQuery.data.selectedSize}</p>
                <ProductProofApproval checked={approvedProofId === proofQuery.data.proofId} onChange={checked => setApprovedProofId(checked ? proofQuery.data.proofId : '')} warnings={proofQuery.data.warnings} />
              </div>}
              <button type="button" className="btn btn-primary product-detail__buy"
                onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending || proofQuery.isFetching || !selectedSize || !approvedProofId || approvedProofId !== proofQuery.data?.proofId}
                data-testid="button-buy-now">
                {checkoutMutation.isPending ? <Loader2 className="product-detail__icon animate-spin" aria-hidden="true" />
                  : <ShoppingCart className="product-detail__icon" aria-hidden="true" />}
                {checkoutMutation.isPending ? 'Creating checkout...' : `Buy Now — $${totalPrice.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="create-own-heading">
        <div className="row">
          <div className="layout__split-2-1 card">
            <div className="cta__text">
              <h2 id="create-own-heading" data-testid="text-create-own-heading">Want to create your own?</h2>
              <p className="cta__message">Design custom QR merchandise and earn {formatProfitSharePercent(DEFAULT_MEMBER_PROFIT_SHARE)} of the profit on every sale.</p>
            </div>
            <div className="btn-row">
              <Link href={createYourOwnUrl} className="btn btn-secondary" data-testid="button-create-your-own">
                <Sparkles className="product-detail__icon" aria-hidden="true" /> Create Your Own
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
