import { useState, useCallback } from "react";

const STORAGE_KEY = "rexiano-onboarding-completed";

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Open a Song",
    description:
      'Click the "Open MIDI File" button to load a song you want to practice.',
    icon: "\uD83C\uDFB5",
  },
  {
    title: "Play It Back",
    description:
      "Press Space to play and watch the notes fall down. Try to follow along!",
    icon: "\u25B6\uFE0F",
  },
  {
    title: "Choose How to Practice",
    description:
      'Pick "Watch" to just listen, "Wait" so it pauses for you, or "Free" to play along freely.',
    icon: "\uD83C\uDFAF",
  },
  {
    title: "Connect Your Keyboard",
    description:
      "Plug in a MIDI keyboard to play along for real. Or just watch and learn first!",
    icon: "\uD83C\uDFB9",
  },
];

/**
 * First-time onboarding overlay. Shows a sequence of 4 steps with
 * friendly child-appropriate text. Stored in localStorage so it
 * only shows once.
 */
export function OnboardingGuide(): React.JSX.Element {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const [currentStep, setCurrentStep] = useState(0);

  const markComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    setVisible(false);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      markComplete();
    }
  }, [currentStep, markComplete]);

  const handleSkip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  if (!visible) return <></>;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center onboarding-backdrop"
      data-testid="onboarding-overlay"
    >
      <div
        className="w-[380px] rounded-2xl shadow-2xl onboarding-card"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        role="dialog"
        aria-label="Welcome guide"
        data-testid="onboarding-card"
      >
        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 pt-5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full onboarding-step-dot ${i === currentStep ? "onboarding-step-dot-active" : ""}`}
              style={{
                background:
                  i === currentStep
                    ? "var(--color-accent)"
                    : i < currentStep
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                opacity: i <= currentStep ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-8 pt-6 pb-4 text-center">
          <span className="text-4xl mb-3" aria-hidden="true">
            {step.icon}
          </span>
          <h2
            className="text-xl font-display font-bold mb-2"
            style={{ color: "var(--color-text)" }}
          >
            {step.title}
          </h2>
          <p
            className="text-sm font-body leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {step.description}
          </p>
        </div>

        {/* Step counter */}
        <p
          className="text-center text-[11px] font-mono"
          style={{ color: "var(--color-text-muted)" }}
        >
          {currentStep + 1} / {steps.length}
        </p>

        {/* Buttons */}
        <div className="flex justify-between px-6 py-4">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-xs font-body rounded-lg cursor-pointer transition-colors"
            style={{
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
            data-testid="onboarding-skip"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="px-5 py-2 text-sm font-display font-bold rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
            data-testid="onboarding-next"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
