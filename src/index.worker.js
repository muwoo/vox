const voxWorker = options => {
  const {config} = options;
  const lifeCircleMap = {
    'lifeCircle:create': [config.create],
  };
  self.setData = (data) => {
    console.log('setData called');
    self.postMessage(
      JSON.stringify({
        type: 'update',
        data,
      })
      ,
      null
    );
  };
  self.postMessage(
    JSON.stringify({
      type: 'init',
      data: config.data,
    })
    ,
    null
  );
  self.onmessage = e => {
    const {type} = JSON.parse(e.data);
    lifeCircleMap[type].forEach(lifeCircle => lifeCircle.call(self))
  }
}

export default voxWorker;