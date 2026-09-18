export interface ShellState { readonly sidebarCollapsed: boolean; readonly mobileDrawerOpen: boolean; }
export const initialShellState: ShellState = { sidebarCollapsed: false, mobileDrawerOpen: false };
export const toggleSidebar = (state: ShellState): ShellState => ({ ...state, sidebarCollapsed: !state.sidebarCollapsed });
export const setMobileDrawer = (state: ShellState, open: boolean): ShellState => ({ ...state, mobileDrawerOpen: open });
