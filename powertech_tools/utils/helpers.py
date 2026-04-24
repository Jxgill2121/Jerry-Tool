# General utility functions for Powertech Tools

import re
import tkinter as tk
from tkinter import ttk
from typing import List


def natural_sort_key(text: str):
    """Natural sorting key that handles numbers in strings"""
    return [int(s) if s.isdigit() else s.lower() for s in re.split(r"(\d+)", text)]


def safe_float(s: str):
    """Safely convert string to float, return None if empty, 'INVALID' if failed"""
    s = (s or "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return "INVALID"


def safe_int(s: str):
    """Safely convert string to int, return None if empty, 'INVALID' if failed"""
    s = (s or "").strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except ValueError:
        return "INVALID"


def make_unique_names(names: List[str]) -> List[str]:
    """Make duplicate column names unique by appending _1, _2, etc."""
    seen = {}
    out = []
    for nm in names:
        if nm not in seen:
            seen[nm] = 0
            out.append(nm)
        else:
            seen[nm] += 1
            out.append(f"{nm}_{seen[nm]}")
    return out


class ScrollableFrame(ttk.Frame):
    """
    A scrollable frame that adapts to any screen resolution.

    Usage:
        scrollable = ScrollableFrame(parent)
        scrollable.pack(fill="both", expand=True)

        # Add widgets to scrollable.content instead of scrollable
        ttk.Label(scrollable.content, text="Hello").pack()
    """

    def __init__(self, parent, *args, **kwargs):
        super().__init__(parent, *args, **kwargs)

        # Get theme background color
        try:
            from powertech_tools.config.theme import PowertechTheme
            bg_color = PowertechTheme.BG_MAIN
        except ImportError:
            bg_color = "#F5F5F5"

        # Create canvas and scrollbar
        self.canvas = tk.Canvas(self, highlightthickness=0, bg=bg_color)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.content = ttk.Frame(self.canvas)

        # Configure canvas scrolling
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        # Create window in canvas
        self.canvas_frame = self.canvas.create_window((0, 0), window=self.content, anchor="nw")

        # Pack canvas and scrollbar
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        # Bind events
        self.content.bind("<Configure>", self._on_frame_configure)
        self.canvas.bind("<Configure>", self._on_canvas_configure)

        # Bind mousewheel only when mouse is over this frame (not global)
        self.canvas.bind("<Enter>", self._bind_mousewheel)
        self.canvas.bind("<Leave>", self._unbind_mousewheel)

    def _bind_mousewheel(self, event=None):
        """Bind mousewheel when mouse enters canvas"""
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)
        self.canvas.bind_all("<Button-4>", self._on_mousewheel)  # Linux scroll up
        self.canvas.bind_all("<Button-5>", self._on_mousewheel)  # Linux scroll down

    def _unbind_mousewheel(self, event=None):
        """Unbind mousewheel when mouse leaves canvas"""
        self.canvas.unbind_all("<MouseWheel>")
        self.canvas.unbind_all("<Button-4>")
        self.canvas.unbind_all("<Button-5>")

    def _on_frame_configure(self, event=None):
        """Update scroll region when content size changes"""
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        """Adjust content width to canvas width"""
        canvas_width = event.width
        self.canvas.itemconfig(self.canvas_frame, width=canvas_width)

    def _on_mousewheel(self, event):
        """Handle mouse wheel scrolling - smoother with larger increments"""
        # Check if scrolling is needed (content taller than viewport)
        if self.canvas.bbox("all") is None:
            return

        # Use larger scroll increments for smoother feel (3 units instead of 1)
        scroll_amount = 3

        if event.num == 5 or event.delta < 0:  # Scroll down
            self.canvas.yview_scroll(scroll_amount, "units")
        elif event.num == 4 or event.delta > 0:  # Scroll up
            self.canvas.yview_scroll(-scroll_amount, "units")
