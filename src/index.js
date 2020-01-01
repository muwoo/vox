import voxWorker from './index.worker';
import { init as workerInit, worker } from './init';

const isInWorker = typeof window === "undefined";

function Vox(options) {
  isInWorker ? voxWorker(options) : workerInit(options);
}

export {Vox}
