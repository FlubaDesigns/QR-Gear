import AdminShell from '@/components/AdminShell';
import AdminSectionSubNav from '@/components/admin/AdminSectionSubNav';
import {SELL_SUBNAV} from '@/components/admin/adminNavConfig';
import {Tag} from 'lucide-react';
import {CouponsSection} from './admin-pricing-coupons';
export default function AdminCoupons(){return <AdminShell title="Promo Codes" subtitle="Manage discount codes" icon={Tag} sectionNav={<AdminSectionSubNav items={SELL_SUBNAV}/>}><CouponsSection/></AdminShell>;}
