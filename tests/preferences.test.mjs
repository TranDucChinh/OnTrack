import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPreferences,translate,localizedRecurrence,localeFor} from '../lib/preferences.mjs';
test('Preferences recover safely from missing or invalid storage and retain only valid values',()=>{
 assert.deepEqual(readPreferences(null),{theme:'light',language:'vi'});
 assert.deepEqual(readPreferences('not json'),{theme:'light',language:'vi'});
 assert.deepEqual(readPreferences('{"theme":"dark","language":"en"}'),{theme:'dark',language:'en'});
 assert.deepEqual(readPreferences('{"theme":"unknown","language":"other"}'),{theme:'light',language:'vi'});
 assert.equal(localeFor('en'),'en-GB');assert.equal(localeFor('vi'),'vi-VN');
});
test('Translation preserves user task names and interpolates data without interpreting markup',()=>{
 assert.equal(translate('Cài đặt','en'),'Settings');assert.equal(translate('Cài đặt','vi'),'Cài đặt');
 const name='Đọc tài liệu <script>test</script>';
 assert.equal(translate('Sửa: {0}','en',{'0':name}),'Edit: '+name);
 assert.equal(translate('Sửa: {0}','vi',{'0':name}),'Sửa: '+name);
 assert.equal(translate('My custom task name','en'),'My custom task name');
 assert.equal(translate('{0} công việc','en',{'0':1}),'1 task');
 assert.equal(translate('{0} công việc','en',{'0':2}),'2 tasks');
});
test('Recurrence descriptions translate without changing schedule values',()=>{
 assert.equal(localizedRecurrence({type:'interval',every:1,unit:'hours'},'en'),'Every 1 hour');
 assert.equal(localizedRecurrence({type:'interval',every:2,unit:'days'},'en'),'Every 2 days');
 assert.equal(localizedRecurrence({type:'weekly',weekdays:[1,3]},'en'),'Weekly · Mon, Wed');
 assert.equal(localizedRecurrence({type:'monthly',day:31},'en'),'Monthly · day 31');
 assert.equal(localizedRecurrence({type:'interval',every:2,unit:'days'},'vi'),'Mỗi 2 ngày');
});
