import { createReducer } from 'redux-starter-kit';
import { Action } from '../type';

export default createReducer(null, {
  CREATE_TASK: (state: string | null, action: Action) => {
    return action.payload.taskId;
  },

  DELETE_TASK: (state: string | null, { payload }: Action) => {
    if (state === payload) {
      return null;
    }
    return state;
  },

  CHANGE_SCREEN: (state: string | null, action: Action) => {
    if (action.payload === `TASKS`) {
      return null;
    }
    return state;
  },

  WORK_ON_TASK: (state: string | null, { payload }: { payload: string }) => {
    return payload;
  },
});
