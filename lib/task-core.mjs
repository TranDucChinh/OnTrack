export function dueTimestamp(deadline) {
  if (!deadline) return Infinity;
  return Date.parse(deadline.length === 10 ? `${deadline}T23:59:00+07:00` : deadline);
}
export function vnDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export function taskBucket(task, now = Date.now()) {
  if (task.done) return 'done';
  if (!task.deadline) return 'undated';
  if (dueTimestamp(task.deadline) < now) return 'overdue';
  if (task.deadline.slice(0,10) === vnDay(new Date(now))) return 'today';
  return 'upcoming';
}
export function validateTask(input) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 500) throw new Error('Tên công việc cần từ 1 đến 500 ký tự.');
  const deadline = input.deadline || '';
  if (deadline && (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:00\+07:00)?$/.test(deadline) || !Number.isFinite(dueTimestamp(deadline)))) throw new Error('Deadline không hợp lệ.');
  if (!['normal','high','low'].includes(input.priority || 'normal')) throw new Error('Mức ưu tiên không hợp lệ.');
  if (typeof input.done !== 'boolean') throw new Error('Trạng thái không hợp lệ.');
  if (input.notes && (typeof input.notes !== 'string' || input.notes.length > 4000)) throw new Error('Ghi chú tối đa 4.000 ký tự.');
  return {name:input.name.trim(), deadline, done:input.done, priority:input.priority || 'normal', notes:input.notes || ''};
}
