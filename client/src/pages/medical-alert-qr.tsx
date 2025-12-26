import { Heart, CheckCircle, AlertTriangle, Pill, Phone, Shield, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Encode allergies, blood type, conditions",
  "Emergency contacts with phone numbers",
  "Medications and dosages",
  "Up to 2,000 characters - room for everything",
  "Permanent QR - critical info that lasts",
];

const infoTypes = [
  {
    icon: AlertTriangle,
    title: "Allergies",
    description: "Penicillin. Peanuts. Latex. When you can't speak, your shirt can.",
  },
  {
    icon: Pill,
    title: "Medications",
    description: "Current prescriptions, dosages, and schedules. First responders need this.",
  },
  {
    icon: Phone,
    title: "Emergency Contacts",
    description: "Mom. Spouse. Doctor. The people who need to know, instantly reachable.",
  },
  {
    icon: Heart,
    title: "Medical Conditions",
    description: "Diabetes. Epilepsy. Heart conditions. Critical context for critical moments.",
  },
];

export default function MedicalAlertQR() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Medical Alert QR | Emergency Info You Wear | QR Gear"
        description="Create wearable medical alert QR codes with allergies, medications, blood type, and emergency contacts. When you can't speak, your shirt can. USA options available."
        keywords="medical alert QR, emergency info shirt, allergy alert, medical ID QR, emergency contacts wearable, health info QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Basics</p>
              <h1 className="text-2xl md:text-4xl font-bold">Medical Alert QR</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Silent lifesaver.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Allergies. Blood type. Emergency contacts. Medications. 
            When you can't speak, your shirt can.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Critical info, always on you, always accessible.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              What you can encode:
            </h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-6">Life-saving information:</h2>
            <div className="grid gap-4">
              {infoTypes.map((info, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <info.icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{info.title}</h3>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-red-500/5 border-red-500/20">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">For anyone with health concerns</h3>
                <p className="text-sm text-muted-foreground">
                  Runners, hikers, seniors, kids with allergies, anyone who wants peace of mind. 
                  First responders know to look for medical IDs. Make yours scannable.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-medical">
              Create Your Medical Alert
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Link href="/qr-static">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-basics">
              ← Back to QR Basics
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
