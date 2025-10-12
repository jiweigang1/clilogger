import child_process from 'child_process'
// 保存原始 spawn
const originalSpawn = child_process.spawn

// 重写 spawn
child_process.spawn = function (...args) {
  adasdadasdsadasdadadsadsadasd
  console.log('Intercepted spawn call:', args)

  // 在这里可以对命令或参数进行修改
  if (args[0] === 'rm') {
    console.warn('Blocking dangerous command')
    return null
  }

  // 调用原始 spawn
  return originalSpawn.apply(this, args)
}