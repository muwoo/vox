export default {
  data: {
    msg: 'hello Vox'
  },
  create() {
    setTimeout(() => {
      this.setData({
        msg: 'setData',
      })
    }, 1000)
  }
}