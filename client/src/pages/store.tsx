import { Redirect } from "wouter";
import { PUBLIC_SHOP_PATH } from "@shared/navigation";

/** Legacy shopping links must never mount the admin product builder. */
export default function StorePage() {
  return <Redirect to={PUBLIC_SHOP_PATH} />;
}
