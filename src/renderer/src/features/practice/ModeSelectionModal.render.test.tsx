// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock lucide-react icons with explicit named exports
vi.mock("lucide-react", () => ({
  Eye: (props: any) => <svg data-testid="icon-Eye" />,
  Hand: (props: any) => <svg data-testid="icon-Hand" />,
  Music: (props: any) => <svg data-testid="icon-Music" />,
}));

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

// Import after mocks
import { ModeSelectionModal } from "./ModeSelectionModal";

describe("ModeSelectionModal render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the modal dialog", () => {
    render(<ModeSelectionModal onSelect={vi.fn()} />);
    expect(screen.getByTestId("mode-selection-modal")).toBeDefined();
    expect(screen.getByTestId("mode-selection-modal-backdrop")).toBeDefined();
  });

  test("renders all three mode buttons", () => {
    render(<ModeSelectionModal onSelect={vi.fn()} />);
    expect(screen.getByTestId("mode-select-watch")).toBeDefined();
    expect(screen.getByTestId("mode-select-wait")).toBeDefined();
    expect(screen.getByTestId("mode-select-free")).toBeDefined();
  });

  test("displays mode titles", () => {
    render(<ModeSelectionModal onSelect={vi.fn()} />);
    expect(screen.getByText("practice.watch")).toBeDefined();
    expect(screen.getByText("practice.wait")).toBeDefined();
    expect(screen.getByText("practice.free")).toBeDefined();
  });

  test("clicking a mode calls onSelect with the mode", () => {
    const onSelect = vi.fn();
    render(<ModeSelectionModal onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("mode-select-wait"));
    expect(onSelect).toHaveBeenCalledWith("wait");
  });

  test("shows mustChoose text when onClose is not provided", () => {
    render(<ModeSelectionModal onSelect={vi.fn()} />);
    expect(screen.getByText("modeSelect.mustChoose")).toBeDefined();
  });

  test("shows escToSkip button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<ModeSelectionModal onSelect={vi.fn()} onClose={onClose} />);
    const skipBtn = screen.getByText("modeSelect.escToSkip");
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
