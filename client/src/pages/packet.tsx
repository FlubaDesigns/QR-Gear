import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, QrCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

interface PacketData {
  id: string;
  compositeUrl: string | null;
  productName: string | null;
  pricing: {
    customerPrice: number;
  } | null;
}

export default function PacketPage() {
  const [match, params] = useRoute("/p/:id");
  const packetId = params?.id;

  const { data, isLoading, error } = useQuery<{ success: boolean; packet: PacketData }>({
    queryKey: ["/api/public/packets", packetId],
    enabled: !!packetId,
  });

  const packet = data?.packet;

  if (!match || !packetId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The content you're looking for doesn't exist or the link is invalid.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This content could not be loaded.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {packet.compositeUrl ? (
        <img 
          src={packet.compositeUrl} 
          alt={packet.productName || "QR Content"} 
          className="max-w-full max-h-screen object-contain"
          data-testid="img-composite"
        />
      ) : (
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">{packet.productName || "QR Content"}</h1>
            {packet.pricing && (
              <p className="text-lg text-muted-foreground">
                ${packet.pricing.customerPrice.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
