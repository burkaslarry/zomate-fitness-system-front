/** [F008][S005] Phone regressions: complete month, accessible overflow, pinned week time gutter. */
import {test,expect} from '@playwright/test';
test.use({channel:process.env.SIGNATURE_TEST_BROWSER_CHANNEL,video:'off',timezoneId:'Asia/Hong_Kong'});

for(const width of [320,375,430]){
  test(`phone ${width}px: month fits and week keeps time visible`,async({page})=>{
    // [F007][S005] Isolated phone fixture never connects to customer API data.
    await page.setViewportSize({width,height:844});
    await page.clock.setFixedTime(new Date('2026-10-23T07:05:00Z'));
    await page.addInitScript(()=>localStorage.setItem('zomate_auth_session',JSON.stringify({token:'offline',role:'COACH',username:'qa'})));
    const sessions=Array.from({length:7},(_,i)=>({enrollment_id:i+1,student_id:i+1,student_name:`Mobile QA ${i}`,student_phone:'90000001',category_id:1,category_name:'Yoga',session_date:'2026-10-23',start_time:`${String(9+i).padStart(2,'0')}:00`,end_time:`${String(10+i).padStart(2,'0')}:00`,branch_name:'QA',checkin_pin:'00000',coach_time_confirmed:true,attendance_status:'未簽到',course_title:`Mobile Yoga ${i}`}));
    await page.route('**/api/**',route=>{
      // [F007][S005] Read-only fixture responses for each requested calendar range.
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/coach/me')return route.fulfill({json:{id:7,full_name:'QA Coach',phone:'90000000'}});
      if(path==='/api/auth/me')return route.fulfill({json:{role:'COACH',username:'qa'}});
      if(path==='/api/coach/sessions')return route.fulfill({json:sessions});
      return route.fulfill({json:[]});
    });
    await page.goto('/coach-portal');
    const month=page.getByLabel('完整月曆');
    await expect(month.getByRole('button',{name:'2026年10月31日週六',exact:true})).toBeVisible();
    expect(await month.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await month.getByRole('button',{name:'2026年10月23日週五全部課堂'}).click();
    const agenda=page.getByLabel('月曆當日課堂');
    await expect(agenda.getByRole('button')).toHaveCount(7);
    await agenda.getByRole('button').filter({hasText:'Mobile QA 6'}).click();
    await expect(page.getByRole('dialog',{name:'課堂詳情'})).toContainText('Mobile Yoga 6');
    await page.getByRole('button',{name:'關閉課堂詳情'}).click();
    await page.getByLabel('教練排程日曆').getByRole('button',{name:'週',exact:true}).click();
    const week=page.getByLabel('每週時間表');
    const gutter=page.getByLabel('固定時間欄',{exact:true});
    const before=await gutter.boundingBox();
    // [F007][S005] Simulate the reported rightward date scroll, then vertical movement.
    await week.evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=180;});
    expect(await week.evaluate(el=>el.scrollLeft)).toBeGreaterThan(200);
    const after=await gutter.boundingBox();
    expect(Math.abs(after!.x-before!.x)).toBeLessThan(2);
    expect(after!.x).toBeGreaterThanOrEqual(0);
    const header=await page.getByLabel('固定時間欄標題').boundingBox();
    expect(Math.abs(header!.x-after!.x)).toBeLessThan(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  });
}
