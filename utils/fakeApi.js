let mockList = [
  {
    id: 1,
    title: '楼道灯不亮',
    category: '一般维修',
    location: '3栋1单元门口',
    contact: '张小姐',
    description: '楼道灯一直不亮，晚上出入不方便，请尽快维修。',
    status: '待处理',
    createdAt: '2026-10-01 09:30'
  },
  {
    id: 2,
    title: '厨房漏水',
    category: '水电维修',
    location: '5栋202室',
    contact: '李先生',
    description: '厨房下水道附近漏水，水位持续上升。',
    status: '处理中',
    createdAt: '2026-10-02 11:20'
  },
  {
    id: 3,
    title: '门禁刷卡异常',
    category: '其他',
    location: '北门闸机',
    contact: '物业岗亭',
    description: '门禁刷卡出现异常，需检查设备。',
    status: '已完成',
    createdAt: '2026-10-03 08:10'
  }
];

function dispatch(path, method = 'GET', data = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (method === 'GET' && path === '/maintenance') {
        resolve(mockList);
        return;
      }

      if (method === 'GET' && path.startsWith('/maintenance/')) {
        const id = Number(path.split('/maintenance/')[1]);
        const item = mockList.find((it) => it.id === id);
        resolve(item || {});
        return;
      }

      if (method === 'POST' && path === '/maintenance') {
        const item = {
          id: Date.now(),
          title: data.title || '新报修',
          category: data.category || '一般维修',
          location: data.location || '未填写',
          contact: data.contact || '未填写',
          description: data.description || '',
          status: data.status || '待处理',
          createdAt: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        };
        mockList.unshift(item);
        resolve(item);
        return;
      }

      if (method === 'PUT' && path.startsWith('/maintenance/')) {
        const id = Number(path.split('/maintenance/')[1]);
        const index = mockList.findIndex((it) => it.id === id);
        if (index !== -1) {
          mockList[index] = {
            ...mockList[index],
            ...data,
            status: data.status || mockList[index].status
          };
          resolve(mockList[index]);
        } else {
          resolve({});
        }
        return;
      }

      resolve({});
    }, 300);
  });
}

module.exports = {
  dispatch
};
