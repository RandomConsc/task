module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? '/task/'  // 必须与仓库名一致
    : '/'
}
