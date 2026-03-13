import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { QRType, SimpleWizardStep } from "@/features/shared/components/wizardSteps/wizardTypes";
import { PRE_STEP_BLACKBOARDS, POST_STEP_BLACKBOARDS, FINAL_CONFIRM_STEPS } from './wizard-sign-in-gate';
import { BLACKBOARD_CONTENT, QR_TYPE_CARDS } from './wizard-blackboard';
import type { BlackboardData } from './wizard-blackboard';
import { Check, Package, Palette, QrCode, TrendingUp } from "lucide-react";
import { createElement } from "react";
import { calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";

interface TutorialDeps {
  userId: string | undefined;
  simpleStep: SimpleWizardStep;
  selectedChannel: { id: string; name: string } | null;
  selectedProductType: { title?: string; memberEarnings?: number } | null;
  selectedColor: string;
  selectedShirtSize: string;
  qrType: QRType;
  pricingSettings: { sizeUpcharges?: Record<string, number>; memberProfitShare?: number } | undefined;
  handleSimpleNext: () => Promise<void>;
  setQrType: (type: QRType) => void;
}

export function useSuperSimpleTutorial(deps: TutorialDeps) {
  const {
    userId, simpleStep, selectedChannel, selectedProductType,
    selectedColor, selectedShirtSize, qrType, pricingSettings,
    handleSimpleNext, setQrType,
  } = deps;

  const [blackboardQueue, setBlackboardQueue] = useState<string[]>(['bb-welcome', 'bb-channels']);
  const [qrTypeExploreStep, setQrTypeExploreStep] = useState<string>('bb-qr-basic');
  const [showQrTypeCards, setShowQrTypeCards] = useState(false);
  const [seenSteps, setSeenSteps] = useState<Set<string>>(new Set(['channel']));
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [showFinishBlackboard, setShowFinishBlackboard] = useState(false);
  const [checkingTutorial, setCheckingTutorial] = useState(true);
  const [tutorialAlreadyDone, setTutorialAlreadyDone] = useState(false);
  const [showQrCongrats, setShowQrCongrats] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCheckingTutorial(false);
      return;
    }
    const check = async () => {
      try {
        const docRef = doc(db, "member_profiles", userId);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.tutorial_complete === true) {
          setTutorialAlreadyDone(true);
        }
      } catch { }
      setCheckingTutorial(false);
    };
    check();
  }, [userId]);

  useEffect(() => {
    if (tutorialAlreadyDone) {
      setBlackboardQueue([]);
      const allStepKeys = Object.keys(PRE_STEP_BLACKBOARDS).concat(Object.keys(POST_STEP_BLACKBOARDS));
      setSeenSteps(prev => {
        const next = new Set(prev);
        allStepKeys.forEach(k => next.add(k));
        return next;
      });
    }
  }, [tutorialAlreadyDone]);

  useEffect(() => {
    if (blackboardQueue.length === 0 && pendingAdvance) {
      setPendingAdvance(false);
      handleSimpleNext();
    }
  }, [blackboardQueue, pendingAdvance]);

  useEffect(() => {
    if (!seenSteps.has(simpleStep)) {
      const preCards = PRE_STEP_BLACKBOARDS[simpleStep];
      if (preCards) {
        setBlackboardQueue([...preCards]);
      }
      setSeenSteps(prev => new Set(prev).add(simpleStep));
    }
  }, [simpleStep]);

  const completeTutorial = async () => {
    try {
      if (userId) {
        await setDoc(
          doc(db, "member_profiles", userId),
          { tutorial_complete: true, tutorial_completed_at: new Date().toISOString() },
          { merge: true }
        );
      }
    } catch (e) {
      console.error('Failed to save tutorial completion:', e);
    }
  };

  const handleBlackboardContinue = () => {
    if (blackboardQueue.length <= 1) {
      setBlackboardQueue([]);
      if (simpleStep === 'type' && blackboardQueue[0] === 'bb-qr-intro') {
        setShowQrTypeCards(true);
      }
    } else {
      setBlackboardQueue(prev => prev.slice(1));
    }
  };

  const handleQrTypeChosen = (type: QRType) => {
    setQrType(type);
    setShowQrTypeCards(false);
    setShowQrCongrats(true);
  };

  const handleQrTypeShowMore = () => {
    const card = QR_TYPE_CARDS[qrTypeExploreStep];
    if (card?.nextStep && QR_TYPE_CARDS[card.nextStep]) {
      setQrTypeExploreStep(card.nextStep);
    }
  };

  const handleSuperNext = async () => {
    if (FINAL_CONFIRM_STEPS.includes(simpleStep) && !seenSteps.has(`finish-${simpleStep}`)) {
      setSeenSteps(prev => new Set(prev).add(`finish-${simpleStep}`));
      await completeTutorial();
      setShowFinishBlackboard(true);
      return;
    }

    const postCards = POST_STEP_BLACKBOARDS[simpleStep];
    if (postCards && !seenSteps.has(`post-${simpleStep}`)) {
      setBlackboardQueue([...postCards]);
      setSeenSteps(prev => new Set(prev).add(`post-${simpleStep}`));
      setPendingAdvance(true);
      return;
    }
    await handleSimpleNext();
  };

  const getCongratsBlackboard = (stepId: string): BlackboardData | null => {
    switch (stepId) {
      case 'bb-channel-congrats':
        return {
          icon: createElement(Check, { className: "w-8 h-8" }),
          title: "Nice Work!",
          lines: [
            { text: selectedChannel
              ? `You picked "${selectedChannel.name}" — great choice!`
              : "You've got your channel set up!" },
            { text: "That's the first step in building your digital storefront.", highlight: true },
            { text: "Everything you create will live in this channel. Customers can browse it like a mini shop." },
            { text: "Next up: picking the product you want to sell. This is where it gets fun." },
          ],
          tip: "You're already ahead of most people. They're still reading the instructions.",
        };
      case 'bb-product-congrats':
        return {
          icon: createElement(Package, { className: "w-8 h-8" }),
          title: "Great Pick!",
          lines: [
            { text: selectedProductType
              ? `You chose the ${selectedProductType.title} — solid choice!`
              : "You've got your product locked in!" },
            { text: "Now you've got something real to work with.", highlight: true },
            { text: "Next we'll tailor it and make it uniquely yours — colors, size, and your own QR experience." },
            { text: "This is where your product starts to come alive." },
          ],
          tip: "Every choice you make from here adds your personal touch. Let's make it yours.",
        };
      case 'bb-color-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        return {
          icon: createElement(Palette, { className: "w-8 h-8" }),
          title: "Looking Good!",
          lines: [
            { text: selectedColor
              ? `Nice color choice! That's going to look great on your mockup.`
              : "Color is set!" },
            { text: `Your earnings so far: $${base.toFixed(2)} per sale`, highlight: true },
            { text: "Good news — color is free. It doesn't change the price at all." },
            { text: "But the next step will. Let's talk about size and how it bumps your earnings up." },
          ],
          tip: "That $" + base.toFixed(2) + " is just the floor. It's about to go higher.",
        };
      }
      case 'bb-size-congrats': {
        const base = selectedProductType?.memberEarnings || 0;
        const sizeBonuses = calculateSizeEarningsBonuses(
          pricingSettings?.sizeUpcharges,
          pricingSettings?.memberProfitShare || 0.25
        );
        const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
        const newTotal = base + sizeBonus;
        return {
          icon: createElement(TrendingUp, { className: "w-8 h-8" }),
          title: "Cha-Ching!",
          lines: [
            { text: `Base earnings: $${base.toFixed(2)}` },
            { text: sizeBonus > 0
              ? `+ Size upgrade (${selectedShirtSize}): +$${sizeBonus.toFixed(2)}`
              : `Size (${selectedShirtSize}): no extra cost — same earnings` },
            { text: `= New total: $${newTotal.toFixed(2)} per sale`, highlight: true },
            { text: "See how that works? Every choice can add to your earnings." },
            { text: "Next up: your QR type. Some of those add even more value." },
          ],
        };
      }
      default:
        return null;
    }
  };

  const getQrCongratsBlackboard = (): BlackboardData => {
    const base = selectedProductType?.memberEarnings || 0;
    const sizeBonuses = calculateSizeEarningsBonuses(
      pricingSettings?.sizeUpcharges,
      pricingSettings?.memberProfitShare || 0.25
    );
    const sizeBonus = sizeBonuses[selectedShirtSize] || 0;
    const currentTotal = base + sizeBonus;
    const typeLabel = qrType === 'qr-basic' ? 'QR Basic' : qrType === 'qr-plus' ? 'QR Plus' : qrType === 'qr-canvas' ? 'QR Canvas' : qrType === 'qr-play' ? 'QR Play' : 'your QR type';
    const isPlatformType = qrType === 'qr-canvas' || qrType === 'qr-play';
    const isBasic = qrType === 'qr-basic';
    const isPlus = qrType === 'qr-plus';

    const getLines = () => {
      const shared = [
        { text: `You picked ${typeLabel} — great choice!` },
        { text: `Your earnings per sale: $${currentTotal.toFixed(2)}`, highlight: true as boolean },
      ];

      if (isBasic) {
        return [
          ...shared,
          { text: "QR Basic is simple and powerful. The QR code bakes your content right in — no server, no platform, no ongoing costs." },
          { text: "Someone scans it, they get your link, text, or contact info instantly. Done." },
          { text: "Want to level up later? QR Canvas and QR Play connect to a living platform where you can change what the QR shows — even after the shirt is printed." },
        ];
      }

      if (isPlus) {
        return [
          ...shared,
          { text: "QR Plus adds your custom header and footer text around the QR code — it makes the design pop and tells people what to expect when they scan." },
          { text: "Like Basic, the QR content is baked in. No server needed, no ongoing costs." },
          { text: "Ready for the next level? QR Canvas and QR Play connect to a living platform — you can update what the QR shows anytime, even after the shirt ships." },
        ];
      }

      return [
        ...shared,
        { text: "When you save this, you're creating a \"moment\" — a unique experience tied to your QR code." },
        { text: qrType === 'qr-canvas'
          ? "Your image becomes a living page anyone can see when they scan."
          : "Your video becomes a living page anyone can watch when they scan."
        },
        { text: "Here's the exciting part: save 2 or more moments and you unlock QR Compose.", highlight: true as boolean },
        { text: "QR Compose lets you build a rotating playlist — one QR code, many experiences. Imagine your shirt showing something different every time someone scans it." },
      ];
    };

    const getTip = () => {
      if (isBasic || isPlus) {
        return "Simple, reliable, and ready to sell. You can always explore Canvas and Play later to unlock even more possibilities.";
      }
      return "Every moment you save gets you closer to QR Compose. Think of it as building your collection.";
    };

    return {
      icon: createElement(QrCode, { className: "w-8 h-8" }),
      title: isPlatformType ? "Save the Moment!" : "Nice and Simple!",
      lines: getLines(),
      tip: getTip(),
    };
  };

  const isShowingBlackboard = blackboardQueue.length > 0;
  const currentBlackboardId = blackboardQueue[0] || null;

  return {
    blackboardQueue,
    qrTypeExploreStep,
    showQrTypeCards,
    showFinishBlackboard, setShowFinishBlackboard,
    checkingTutorial,
    showQrCongrats, setShowQrCongrats,
    isShowingBlackboard,
    currentBlackboardId,
    handleBlackboardContinue,
    handleQrTypeChosen,
    handleQrTypeShowMore,
    handleSuperNext,
    getCongratsBlackboard,
    getQrCongratsBlackboard,
    setBlackboardQueue,
    setPendingAdvance,
  };
}
