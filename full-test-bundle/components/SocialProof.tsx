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
    <section className="testimonials-section">
      <div className="container">
        <div className="testimonials-header">
          <h2>Join 10,000+ Satisfied Customers</h2>
          <div className="testimonials-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} />
            ))}
          </div>
          <p className="testimonials-rating">4.9 out of 5 stars from verified customers</p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.id} 
              className="glass-card testimonial-card"
              data-testid={`testimonial-${testimonial.id}`}
            >
              <div className="testimonial-stars">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} />
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
              <p className="testimonial-author">— {testimonial.name}</p>
            </div>
          ))}
        </div>

        <div className="testimonials-image">
          <img
            src={scanningImage}
            alt="Customer scanning QR code"
          />
        </div>
      </div>
    </section>
  );
}
