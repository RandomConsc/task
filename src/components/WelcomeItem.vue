<template>
  <div class="item">
 <!-- 右侧盒子：聊天框 -->
        <!-- <div class="chat-box">
          <h4>这里是聊天框</h4>
          <el-input placeholder="请输入消息" v-model="chatMessage" @keyup.enter="sendMessage">
            <template #append>
              <el-button @click="sendMessage">发送</el-button>
            </template>
          </el-input>
          <div class="chat-messages">
            <p v-for="(message, index) in chatMessages" :key="index">{{ message }}</p>
          </div> 
        </div> -->
  </div>
</template>

<style scoped>
/* 定义了一个类名为 .item 的样式块，用于设置项目的背景颜色、外边距、布局方式以及定位方式 */
.item {
  background-color: beige;
  margin-top: 2rem;
  display: flex;
  position: relative;
}

/* 定义了一个类名为 .details 的样式块，用于设置项目的详细信息区域的布局和边距 */
.details {
  flex: 1;
  margin-left: 1rem;
}

/* 定义了一个 h3 元素的样式块，用于设置标题的字体大小、字体粗细、下边距以及颜色 */
h3 {
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: var(--color-heading);
}

/* 媒体查询，当屏幕宽度大于等于 1024px 时，应用以下样式 */
@media (min-width: 1024px) {
  /* 调整 .item 类的外边距和内边距 */
  .item {
    margin-top: 0;
    padding: 0.4rem 0 1rem calc(var(--section-gap) / 2);
  }

 

  /* 在 .item 元素前添加一个伪元素，用于绘制垂直分隔线 */
  .item:before {
    content: ' ';
    border-left: 1px solid var(--color-border);
    position: absolute;
    left: 0;
    bottom: calc(50% + 25px);
    height: calc(50% - 25px);
  }

  /* 在 .item 元素后添加一个伪元素，用于绘制垂直分隔线 */
  .item:after {
    content: ' ';
    border-left: 1px solid var(--color-border);
    position: absolute;
    left: 0;
    top: calc(50% + 25px);
    height: calc(50% - 25px);
  }

  /* 隐藏第一个 .item 元素的 :before 伪元素 */
  .item:first-of-type:before {
    display: none;
  }

  /* 隐藏最后一个 .item 元素的 :after 伪元素 */
  .item:last-of-type:after {
    display: none;
  }
}
</style>