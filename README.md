## vox 小程序框架雏形


## run example
```
npm i
npm run dev
npm run exapmle
```

## 小程序内部实现原理概览

[小程序原理demo](https://github.com/muwoo/vox)

对于小程序框架实现原理，在支付宝小程序官方文档上有这样一段描述：
>与传统的 H5 应用不同，小程序运行架构分为 webview 和 worker 两个部分。webview 负责渲染，worker 则负责存储数据和执行业务逻辑。
1.webview 和 worker 之间的通信是异步的。这意味着当我们调用 `setData` 时，我们的数据并不会立即渲染，而是需要从 worker 异步传输到 webview。
2.数据传输时需要序列化为字符串，然后通过 evaluateJavascript 方式传输，数据大小会影响性能。

概括一下，大致意思是小程序框架核心是通过2个线程来完成的，主线程负责webView的渲染工作，worker线程负责js执行。说到这里，你是不是会产生一个疑问：**为什么多线程通信损耗性能还要搞多线程呢？** 可能大多数人都知道因为Web技术实在是太开放了，开发者可以为所欲为。这种情况在小程序中是不允许的，不允许使用<iframe>、不允许<a>直接外跳到其他在线网页、不允许开发者触碰DOM、不允许使用某些未知的危险API等。但是，仔细想想其实单线程也有能力来阻止用户操作这些危险动作，比如通过全局配置黑名单API、改写框架内部编译机制，屏蔽危险操作... 但是却始终无法解决一个问题：如何防止开发者做一些我们想禁用的功能。因为是一个网页，开发者可以执行JS，可以操作DOM，可以操作BOM，可以做一切事情。so，我们需要一个沙箱环境，来运行我们的js，这个沙箱环境需要可以屏蔽掉所有的危险动作。说了这么多，大致想法如下：
![image](https://user-images.githubusercontent.com/21073039/71639569-da369600-2cb3-11ea-839e-10f0fa152a65.png)
关于UI层的渲染，有很多实现方式，比如通过类似VNode -> diff的自定义渲染方式来实现了一个简易的小程序框架：
```jsx
function App (props) {
  const {msg} = props; 
  return () => (
    <div class="main">
      {msg}
    </div>
  )
}

render(<App msg="hello world" />)
```
核心就是通过定义`@babel/plugin-transform-react-jsx`插件来转换 jsx，生成Vnode，再交给Worker通过Diff，最后通过worker postmsg 来通知渲染进程更新：
```js
let index = 0;
// 得到diff差异
let diffData = diff(0, index, oldVnode, newVnode);
// 通知渲染进程更新
self.postMessage(JSON.stringify(diffData)); 
```
有点麻烦？能不能继承现有框架能力？比如Vue、React。当然可以，我们下面就来介绍基于Vue来实现的demo.

## 实现一个基于Vue的小程序框架
有了上面的知识，我们先不着急写代码，先来捋一下我们需要什么，首先我们需要实现这样一个能力：渲染层和逻辑层分离，emmm。。。大致我们的小程序是这样的
```js
// page.js 逻辑层
export default {
  data: {
    msg: 'hello Vox',
  },
  create() {
    console.log(window);
    setTimeout(() => {
      this.setData({
        msg: 'setData',
      })
    }, 1000);
  },
}
```

```js
// page.vxml.js 渲染层
export default () => {
  return '<div>{{msg}}</div>';
}
```
这里的渲染层为啥不是类似于微信或者支付宝小程序 ```wxml,axml```这样的呢？当然可以，其实我只是为了方便而已，我们可以手写一个webpack loader 来处理一下我们自定义的文件。这里有兴趣的小伙伴可以尝试一下。不是本次介绍的核心。

好了，上面是我们想要的功能，我们核心是框架，框架层要干的事核心有2个：构造worker初始化引擎；构造渲染引擎。
```js
// index.worker.js 构造worker
const voxWorker = options => {
  const {config} = options;
  // Vue生命周期收集
  const lifeCircleMap = {
    'lifeCircle:create': [config.create],
  };
  // 定义setData方法用于通知UI层渲染更新
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
  // worker构建完成，通知渲染层初始化
  self.postMessage(
    JSON.stringify({
      type: 'init',
      data: config.data,
    })
    ,
    null
  );
  // 执行生命周期函数
  self.onmessage = e => {
    const {type} = JSON.parse(e.data);
    lifeCircleMap[type].forEach(lifeCircle => lifeCircle.call(self))
  }
}

export default voxWorker;
```
上面代码核心干的事其实并不复杂，也就是：
1. 收集需要用到的生命周期
2. 定义setData函数，提供给用户层更新UI
3. 定义监听函数，处理生命周期函数执行
4. 通知UI进程开启渲染。

当我们通知UI进程开始渲染的时候，UI进程也就是需要构造Vue实例，进行页面render:
```js
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
  }
```

可以看到UI线程在初始化的时候，一并初始化了 worker层传递来的data，并对生命周期进行了声明。当生命周期函数在UI层触发的时候，会通知 worker。在我们的例子中，create 钩子通过setData 进行了一个更新data的动作。我们知道 setData 就是拿到数据进行通知更新：
```js
// UI线程接收到通知消息，更新UI
 if (type === 'update') {
      Object.keys(data).map(key => {
        target[key] = data[key];
      });
    }
```
说到这里，似乎一切都感觉清楚多了。我们很容易想到不断地数据传输对性能的损耗，所以我们当然可以做进一步的优化，多个setData可以组合一起发送？就是建立一个通信。其次再看一些，我们的worker再通信传输数据的过程中不断通过字符串的`parse`和`stringify`

![image](https://user-images.githubusercontent.com/21073039/71639865-41efdf80-2cba-11ea-8799-516788e84aac.png)

绿色部分时原生JSON.stringify(), 关于这一块如何提升性能一方面可以通过减少数据传输量，其他的优化也可以参考这里[如何提升JSON.stringify()的性能](https://juejin.im/post/5cf61ed3e51d4555fd20a2f3)

最后你可能会问，小程序用法都是 `<view>, <text>` 之类的标签，为啥我这里直接用了 `<div>`。其实吧，<view> 也就是 <div> 的语法糖，写一个 vue组件，组件名称叫`view`是不是就可以了呢？

有兴趣的可以查看源码[Vox](https://github.com/muwoo/vox)

## 结语
引用知乎上的一段话：
> 其实，大家对小程序的底层实现都是使用双线程模型，大家对外宣称都会说是为了：方便多个页面之间数据共享和交互为native开发者提供更好的编码体验为了性能（防止用户的JS执行卡住UI线程）其他好处但其实真正的原因其实是：“安全”和“管控”，其他原因都是附加上去的。因为Web技术是非常开放的，JavaScript可以做任何事。但在小程序这个场景下，它不会给开发者那么高的权限：不允许开发者把页面跳转到其他在线网页不允许开发者直接访问DOM不允许开发者随意使用window上的某些未知的可能有危险的API，当然，想解决这些问题不一定非要使用双线程模型，但双线程模型无疑是最合适的技术方案。

经过上面的介绍，是不是发现小程序其实也就那么回事，并没有多么....这边文章主要希望能让你对经常使用的框架有一个原理性的初步认识，至少我们再用的时候可以规避掉一些坑，或者性能问题。

参考文章：
[https://zhuanlan.zhihu.com/p/81775922](https://zhuanlan.zhihu.com/p/81775922)
[双线程前端框架：Voe.js](https://juejin.im/post/5dd1edf3e51d4561ea3fb3cd)



