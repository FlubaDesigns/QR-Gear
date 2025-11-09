import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import scanningImage from "@assets/generated_images/Phone_scanning_QR_cap_37352447.png";

const testimonials = [
  {
    id: 1,
    name: "Sarah M.",
    rating: 5,
    text: "Love my custom QR code shirt! Put my contact info on it in case I lose it at the gym. Brilliant idea!",
  },
  {
    id: 2,
    name: "Michael R.",
    rating: 5,
    text: "Ordered 50 hats with our company QR code for the team. Quality is outstanding and all made in USA!",
  },
  {
    id: 3,
    name: "Jennifer L.",
    rating: 5,
    text: "The Ten Commandments QR code design is amazing. Such a unique way to share faith!",
  },
];

export default function SocialProof() {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Join 10,000+ Satisfied Customers
          </h2>
          <div className="flex items-center justify-center gap-1 text-yellow-500 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="w-6 h-6 fill-current" />
            ))}
          </div>
          <p className="text-muted-foreground">4.9 out of 5 stars from verified customers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} data-testid={`testimonial-${testimonial.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-1 text-yellow-500 mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm mb-4">"{testimonial.text}"</p>
                <p className="text-sm font-semibold">— {testimonial.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg overflow-hidden max-w-3xl mx-auto">
          <img
            src={scanningImage}
            alt="Customer scanning QR code"
            className="w-full h-auto"
          />
        </div>
      </div>
    </section>
  );
}
