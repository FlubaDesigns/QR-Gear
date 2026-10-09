import { AllowedProductsEditor } from './AllowedProductsEditor';
export function MemberProductLibrary() {
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Products</h2><AllowedProductsEditor storeId="member-products" /></section>;
}
