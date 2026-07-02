// dialogSlice 负责全局弹窗状态管理。
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type DialogType = 'notice' | 'error';

export interface DialogPayload {
  title?: string;
  message?: string;
}

export interface DialogState {
  isOpen: boolean;
  type: DialogType | null;
  payload: DialogPayload | null;
}

const initialState: DialogState = {
  isOpen: false,
  type: null,
  payload: null,
};

const dialogSlice = createSlice({
  name: 'dialog',
  initialState,
  reducers: {
    openDialog: (
      state,
      action: PayloadAction<{ type: DialogType; payload?: DialogPayload }>
    ) => {
      state.isOpen = true;
      state.type = action.payload.type;
      state.payload = action.payload.payload ?? null;
    },
    closeDialog: (state) => {
      state.isOpen = false;
      state.type = null;
      state.payload = null;
    },
  },
});

export const { openDialog, closeDialog } = dialogSlice.actions;

export default dialogSlice.reducer;
