import {
  cancel,
  create,
  draw,
  publish,
  rebuildGrid,
  release,
  remove,
  sell,
  setPhone,
  update,
} from './raffle';

export const server = {
  raffle: {
    create,
    publish,
    sell,
    release,
    update,
    setPhone,
    rebuildGrid,
    draw,
    cancel,
    remove,
  },
};
