export interface ShellState {
  readonly mobileDrawerOpen: boolean;
  readonly autoSidebarActive: boolean;
}

export const initialShellState: ShellState = {
  mobileDrawerOpen: false,
  autoSidebarActive: false,
};

export const setMobileDrawer = (state: ShellState, open: boolean): ShellState => ({
  ...state,
  mobileDrawerOpen: open,
});

export const setAutoSidebarActive = (state: ShellState, active: boolean): ShellState => ({
  ...state,
  autoSidebarActive: active,
});
