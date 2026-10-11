import { Link } from "wouter";
import { PUBLIC_SHOP_PATH } from '@shared/navigation';
import { useQuery } from "@tanstack/react-query";
import { Shield, FlaskConical, Users, Store, ArrowRight, Check } from "lucide-react";
import { QR_GEAR } from "@/data/shopHierarchy";
import type { StoreResponse } from "@/features/storefront/types";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import ActionCards from "@/components/ActionCards";
import IdeaLinks from "@/components/IdeaLinks";
import FeaturedProducts from "@/components/FeaturedProducts";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import usa250HeroImg from "@assets/generated_images/usa250_store_card_hero.png";

const featuredChannel = QR_GEAR.channels[0];

function AdminQuickAccess() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return (
    <div className="admin-quick-bar">
      <Link href="/admin" className="admin-quick-link" data-testid="link-admin-quick">
        <Shield className="w-4 h-4" />
        Admin Panel
      </Link>
      <Link href="/admin/products" className="admin-quick-link" data-testid="link-products">
        <FlaskConical className="w-4 h-4" />
        Products
      </Link>
      <Link href="/members" className="admin-quick-link" data-testid="link-member">
        <Users className="w-4 h-4" />
        Member Dashboard
      </Link>
      <Link href="/admin/store-builder" className="admin-quick-link" data-testid="link-store-builder">
        <Store className="w-4 h-4" />
        Store Builder
      </Link>
    </div>
  );
}

function BecomeMember() {
  return (
    <section className="home-section home-members" aria-labelledby="home-members-title">
      <div className="row">
        <div className="layout__split-2">
          <div className="home-members-copy">
            <p className="kicker">For the creators</p>
            <h2 id="home-members-title">You create.<br />We handle the rest.</h2>
            <p>Design your own QR Gear, share your collection, and earn when your creations sell. Products are made to order and shipped directly to your customers.</p>
          </div>
          <div className="home-members-details">
            <ul>
              <li><Check aria-hidden="true" /> Free to join, with your own member studio</li>
              <li><Check aria-hidden="true" /> Earn from every sale of your designs</li>
              <li><Check aria-hidden="true" /> Production and shipping handled for you</li>
            </ul>
            <div className="btn-row">
              <Link href="/members" className="qr-btn qr-btn--accent" data-testid="button-become-member">Become a Member <ArrowRight aria-hidden="true" /></Link>
              <Link href="/earn" className="home-text-link" data-testid="button-learn-earning">How earning works <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedStores() {
  return (
    <div className="home-collection-banner row">
      <div className="layout__split-2">
        <div className="home-collection-copy">
          <p className="kicker">The featured collection</p>
          <h2 id="featured-products-title">{featuredChannel.label}<span>History you can wear.</span></h2>
          <p>{featuredChannel.intro}</p>
          <nav className="home-collection-links" aria-label="Explore USA 250 collections">
            {featuredChannel.collections.map(collection => (
              <Link key={collection.slug} href={`${PUBLIC_SHOP_PATH}/${featuredChannel.slug}/${collection.slug}`}>{collection.label} <ArrowRight aria-hidden="true" /></Link>
            ))}
          </nav>
        </div>
        <Link href={`${PUBLIC_SHOP_PATH}/${featuredChannel.slug}`} className="home-collection-media" aria-label={`Shop ${featuredChannel.label}`}>
          <img src={usa250HeroImg} alt="QR Gear USA 250 shirt at the Washington Monument" loading="lazy" />
          <span>Wear the history. Discover the story. <ArrowRight aria-hidden="true" /></span>
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { data, isLoading, error, refetch } = useQuery<StoreResponse>({
    queryKey: ["/api/store", QR_GEAR.storeType, QR_GEAR.storeName, featuredChannel.slug, null, featuredChannel.slug],
    queryFn: async () => {
      const res = await fetch(`/api/store/${QR_GEAR.storeType}/${QR_GEAR.storeName}?channel=${encodeURIComponent(featuredChannel.slug)}`);
      if (!res.ok) throw new Error("The store catalog could not be loaded. Please try again.");
      const catalog = await res.json();
      if (!Array.isArray(catalog.products)) throw new Error("The store returned an invalid product list. Please try again.");
      return catalog;
    },
  });

  const featuredProduct = data?.products.find(product => product.qrProductType === "qr-canvas");

  return (
    <>
      <SEO title="QR Gear — Wear the Story. Share It with a Scan." description="Make meaningful QR gear for your memories, your message, or your brand. Create your own or shop the USA 250 collection." />
      <AdminQuickAccess />
      <div className="home-page row">
        <Hero product={featuredProduct} isLoading={isLoading} catalogError={error} />
        <HowItWorks />
        <ActionCards />
        <section id="qr-ideas" className="home-section" aria-labelledby="home-ideas-title">
          <div className="section-header">
            <p className="kicker">Made for your moment</p>
            <h2 id="home-ideas-title">Ideas &amp; Occasions</h2>
            <p>For your business, your people, or a gift with a story to tell.</p>
          </div>
          <IdeaLinks />
        </section>
        <section className="home-section home-collection" aria-labelledby="featured-products-title">
          <FeaturedStores />
          <FeaturedProducts products={data?.products} isLoading={isLoading} error={error} onRetry={() => void refetch()} collectionHref={`${PUBLIC_SHOP_PATH}/${featuredChannel.slug}`} />
        </section>
        <BecomeMember />
      </div>
    </>
  );
}
