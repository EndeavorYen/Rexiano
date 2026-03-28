// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";

describe("SongLibraryFilters", () => {
  beforeEach(() => {
    cleanup();
    useSongLibraryStore.setState({
      searchQuery: "",
      gradeFilter: "all",
    });
  });

  it("renders search input and grade options", () => {
    render(<SongLibraryFilters />);
    expect(screen.getByRole("textbox")).toBeDefined();
    expect(screen.getAllByRole("radio").length).toBe(10);
  });

  it("updates search query in store when typing", () => {
    render(<SongLibraryFilters />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "moonlight" },
    });
    expect(useSongLibraryStore.getState().searchQuery).toBe("moonlight");
  });

  it("updates grade filter in store when clicking a grade", () => {
    render(<SongLibraryFilters />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[3]); // grade 2
    expect(useSongLibraryStore.getState().gradeFilter).toBe(2);
  });
});

