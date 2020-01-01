import Vue from 'vue';
export let worker = null;
let target = null;

export const init = options => {
  const {template} = options;

  const {path} = options;
  worker = new Worker(path);

  worker.onmessage = e => {
    const {type, data} = JSON.parse(e.data);
    if (type === 'init') {
      const mountNode = document.createElement('div');
      document.body.appendChild(mountNode);
      target = new Vue({
        el: mountNode,
        data: () => data,
        template: template(),
        created(){
          worker.postMessage(JSON.stringify({
              type: 'lifeCircle:create',
            })
            ,
            null);
        }
      });
    }

    if (type === 'update') {
      Object.keys(data).map(key => {
        target[key] = data[key];
      });
    }
  }
};