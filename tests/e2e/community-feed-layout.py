"""Real Chromium geometry for source-order masonry and display-only titles."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root = Path.cwd()
output = root / 'test-results/v103'
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, channel='chrome')
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda error: errors.append(str(error)))
 page.set_content('<main class="community-public"><div class="feed community-feed"></div></main>')
 page.add_style_tag(content=root.joinpath('style.css').read_text()+root.joinpath('src/ui/community.css').read_text()+' main{margin:0;max-width:100%;padding:20px}.community-title-text{font-family:Arial,"PingFang SC",sans-serif}')
 page.evaluate('''() => {
 const titles=['我的两只猫每天一起长大呀！','一起出游看见小动物','猫','很长的标题'.repeat(18),'English title with punctuation and lengthy words together!','🐈一起看🐕一起长大啦！','最后一行不应该是一个标点！','更多动物陪我们一起散步玩耍啦'];
 const feed=document.querySelector('.community-feed');
 titles.forEach((title,i)=>{
  const card=document.createElement('article');card.className='post community-card';card.dataset.index=i;
  const image=document.createElement('div');image.style.height=[240,90,120,180][i%4]+'px';image.style.background=['#deebd7','#efe2cd','#dce4ef'][i%3];image.textContent='完整图片区域（合成夹具）';
  const content=document.createElement('div');content.className='post-content';
  const h=document.createElement('h2'),entry=document.createElement('button'),text=document.createElement('span');entry.className='community-title-entry';entry.setAttribute('aria-label',title);text.className='community-title-text';text.dataset.fullTitle=title;text.textContent=title;entry.append(text);h.append(entry);
  const author=document.createElement('div');author.className='post-user public-identity';author.innerHTML='<button class="public-avatar community-author-avatar">猫</button><button class="community-author">测试作者的很长昵称需要单行省略</button>';
  content.append(h,author);card.append(image,content);feed.append(card);
 });
 window.originalNodes=Array.from(feed.children);
 const orphan=feed.children[0].querySelector('.community-title-text');orphan.dataset.fullTitle='一二三四五六七';orphan.textContent=orphan.dataset.fullTitle;orphan.parentElement.setAttribute('aria-label',orphan.dataset.fullTitle);orphan.style.width='114px';orphan.style.textWrap='wrap';
}''')
 module=root.joinpath('src/ui/community-feed-layout.js').read_text().replace('export ','')
 page.add_script_tag(content=module+'\nwindow.lines=lineGroups; window.layout=mountCommunityFeedLayout({feed:document.querySelector(".community-feed")});')
 page.wait_for_timeout(200)
 assert '\u2060' in page.locator('.community-title-text').first.text_content(), 'actual measured single-character tail should join with previous character'
 checks=[]
 for width in [1440,768,390,320,1440]:
  page.set_viewport_size({'width':width,'height':1000})
  page.wait_for_timeout(220)
  result=page.evaluate('''() => ({
   width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth,
   sourceNodes:window.originalNodes.every((node,i)=>node===document.querySelector('.community-feed').children[i]),
   titles:Array.from(document.querySelectorAll('.community-title-text')).map(n=>({full:n.dataset.fullTitle,display:n.textContent,lines:window.lines(n).map(l=>l.parts.length),aria:n.parentElement.getAttribute('aria-label')})),
   cards:Array.from(document.querySelectorAll('.community-card')).map(n=>({top:n.offsetTop,left:n.offsetLeft,height:n.offsetHeight})),
  })''')
  assert not result['overflow'], result
  assert result['sourceNodes'], 'layout must never replace or reorder card/image nodes'
  for title in result['titles']:
   assert len(title['lines']) <= 2, title
   assert title['aria']==title['full'], 'accessible title stays complete'
   assert len(title['lines']) != 2 or title['lines'][-1] != 1, title
  cards=result['cards']
  if width>340:
   assert any(card['top']>cards[1]['top'] and card['left']==cards[1]['left'] and card['top']<cards[0]['top']+cards[0]['height'] for card in cards[2:]), 'short card column should continue below its own content'
  page.screenshot(path=str(output/f'feed-layout-{width}.png'),full_page=True)
  checks.append(result)
 page.evaluate('document.querySelector(".community-feed").innerHTML="<div class=empty><h3>No posts</h3><p>Try another filter</p></div>";window.layout.refresh()')
 page.wait_for_timeout(100)
 assert page.locator('.community-feed').bounding_box()['height'] >= page.locator('.empty').bounding_box()['height'], 'empty filtered feed must reserve natural message height'
 page.evaluate('window.layout.destroy();document.querySelector(".community-feed").remove()')
 page.wait_for_timeout(200)
 assert not errors,errors
 browser.close()
 output.joinpath('feed-layout-browser.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
 print(json.dumps({'widths':[x['width'] for x in checks],'allTitlesTwoLinesWithoutSingleton':True,'sourceNodesPreserved':True,'errors':errors}))
