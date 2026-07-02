// entities/user/store/userSlice 维护用户会话的 Redux 分片。
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserSession } from '../types';

interface UserState {
  session: UserSession | null;
}

const initialState: UserState = {
  session: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<UserSession | null>) {
      state.session = action.payload;
    },
    clearSession(state) {
      state.session = null;
    },
  },
});

export const { setSession, clearSession } = userSlice.actions;

export default userSlice.reducer;
