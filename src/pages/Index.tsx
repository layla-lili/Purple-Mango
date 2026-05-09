import React from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FlowSteps from "@/components/FlowSteps";
import MintCard from "@/components/MintCard";
import ActionSpecPanel from "@/components/ActionSpecPanel";
import Footer from "@/components/Footer";

const Index: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col relative bg-background">
      {/* Background noise */}
      <div className="fixed inset-0 pointer-events-none pm-noise" />

      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-pm-purple/[0.03] blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-pm-mango/[0.02] blur-[120px]" />
      </div>

      <Header />

      <main className="flex-1 relative z-10 px-4 sm:px-6">
        <HeroSection />
        <FlowSteps />
        <MintCard />
        <ActionSpecPanel />
        <div className="h-8" />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
