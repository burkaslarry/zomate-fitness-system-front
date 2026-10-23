/** [F007][S005] Calendar and payment edits use intercepted APIs only. */
import { test, expect } from '@playwright/test';
test.use({channel:process.env.SIGNATURE_TEST_BROWSER_CHANNEL,video:'off',timezoneId:'Asia/Hong_Kong'});

/** [F008][S005] All appointments remain visible in day/week/month, including overlaps. */
test('calendar day week month and locked lessons',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-23T07:05:00Z'));
  await page.addInitScript(()=>localStorage.setItem('zomate_auth_session',JSON.stringify({token:'offline',role:'COACH',username:'qa'})));
  const sessions=Array.from({length:7},(_,i)=>({enrollment_id:i+1,student_id:i+1,student_name:`Calendar QA ${i}`,student_phone:'90000001',category_id:1,category_name:'Yoga',session_date:'2026-10-23',start_time:i<2?'09:00':`${String(8+i).padStart(2,'0')}:00`,end_time:i<2?'10:00':`${String(9+i).padStart(2,'0')}:00`,branch_name:'QA',checkin_pin:'00000',coach_time_confirmed:true,attendance_status:i===0?'已簽到':'未簽到',course_title:`Yoga QA ${i}`}));
  await page.route('**/api/**',route=>{
    // [F007][S005] Intercept every API path; no real account data is touched.
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/coach/me')return route.fulfill({json:{id:7,full_name:'QA',phone:'90000000'}});
    if(path==='/api/auth/me')return route.fulfill({json:{role:'COACH',username:'qa'}});
    if(path==='/api/coach/sessions')return route.fulfill({json:sessions});
    return route.fulfill({json:[]});
  });
  await page.goto('/coach-portal');
  const calendar=page.getByLabel('教練排程日曆');
  await expect(calendar.getByRole('button').filter({hasText:'Calendar QA'})).toHaveCount(7);
  await calendar.getByRole('button',{name:'週',exact:true}).click();
  const week=page.getByLabel('每週時間表');
  expect((await week.boundingBox())!.width).toBeGreaterThanOrEqual(900);
  await expect(week.getByRole('button').filter({hasText:'Calendar QA'})).toHaveCount(7);
  const a=await week.getByRole('button').filter({hasText:'Calendar QA 0'}).boundingBox();
  const b=await week.getByRole('button').filter({hasText:'Calendar QA 1'}).boundingBox();
  expect(a!.x).not.toBe(b!.x);expect(a!.y).toBe(b!.y);
  await calendar.getByRole('button',{name:'日',exact:true}).click();
  await expect(page.getByLabel('每日時間表').getByRole('button').filter({hasText:'Calendar QA'})).toHaveCount(7);
  await page.getByLabel('每日時間表').getByRole('button').filter({hasText:'Calendar QA 0'}).click();
  await expect(page.getByRole('dialog',{name:'課堂詳情'})).toContainText('已鎖定');
  await page.getByRole('button',{name:'關閉課堂詳情'}).click();
  await expect(page.locator('details li').filter({hasText:'Calendar QA 0'}).getByRole('button',{name:'改期',exact:true})).toHaveCount(0);
});

/** [F004][S002] Explicit Admin save persists values and survives a reload. */
test('Admin edits payment details',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('zomate_auth_session',JSON.stringify({token:'offline',role:'ADMIN',username:'qa'})));
  let writes=0;
  let row={id:'renewal-7',record_type:'renewal',ref_id:7,student_id:404,student_name:'Payment QA',student_phone:'90000001',amount:3000,payment_method:'fps',status:'pending_confirmation',label:'QA course',created_at:'2026-10-23T15:00:00+08:00',note:'QA'};
  await page.route('**/api/**',route=>{
    // [F007][S005] Persistence exists only in test memory.
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{role:'ADMIN',username:'qa'}});
    if(path==='/api/admin/payment-records/renewal/7'&&route.request().method()==='PATCH'){
      writes++;row={...row,...route.request().postDataJSON()};return route.fulfill({json:{ok:true,record:row}});
    }
    if(path==='/api/admin/payment-records')return route.fulfill({json:{records:[row],total:1}});
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/payments');
  await page.getByRole('button',{name:'詳情',exact:true}).click();
  await page.getByRole('button',{name:'編輯付款詳情'}).click();
  await page.getByLabel('編輯金額').fill('3200');
  await page.getByLabel('編輯付款方式').selectOption('cash');
  await page.getByLabel('編輯備註').fill('QA corrected');
  await page.getByRole('button',{name:'儲存修改'}).click();
  await expect(page.getByRole('dialog')).toContainText('3,200');
  await expect(page.getByRole('dialog')).toContainText('QA corrected');expect(writes).toBe(1);
  await page.reload();
  await page.getByRole('button',{name:'詳情',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('3,200');
  await expect(page.getByRole('dialog')).toContainText('QA corrected');
});
