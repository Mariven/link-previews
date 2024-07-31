// ==UserScript==
// @name         Link Previews
// @version      0.8
// @description  Show previews of Wikipedia, Arxiv, LessWrong, and Github links on hover
// @author       Mariven
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
	'use strict';

	let captures = {
		arxiv: {
			regex: /.*\/\/(?:www\.)?arxiv.org\/(?:abs|pdf)\/((?:[\w-]+\/)?\d+\.?\d+(?:v\d)?)(?:\.pdf)?/,
			groups: ['id'],
			fetch: fetchArxivInfo,
			exceptions: [],
			textColor: '#900',
			textContent: 'A',
		},
		wikipedia: {
			regex: /.*?wikipedia.org\/wiki\/(.+)/,
			groups: ['title'],
			fetch: fetchWikipediaInfo,
			exceptions: [/.*?wikipedia.org.*?/],
			textColor: '#009',
			textContent: 'W',
		},
		lesswrong: {
			regex: /.*?lesswrong.com\/posts\/(.+)\/.*/,
			groups: ['id'],
			fetch: fetchLessWrongInfo,
			exceptions: [/.*?wrong.com.*?/, /.*?effectivealtruism.org.*?/, /.*?alignmentforum.org.*?/, /.*?arbital.com.*?/],
			textColor: '#090',
			textContent: 'L',
		},
		github: {
			regex: /https?:\/\/(?:www\.)?github\.com\/([\w-]+)\/([\w-]+)\/?$/,
			groups: ['owner', 'repo'],
			fetch: fetchGithubInfo,
			exceptions: [/.*?github\.com.*?/],
			textColor: '#333',
			textContent: 'G',
		},
	};
	let styles = {
		'preview-div': {
			'position': 'fixed',
			'zIndex': 10000,
			'backgroundColor': 'white',
			'border': '1px solid black',
			'padding': '10px',
			'maxWidth': '600px',
			'maxHeight': '400px',
			'overflowY': 'auto',
			'display': 'none',
			'borderRadius': '4px',
			'transition': 'opacity 0.5s ease-in',
			'textAlign': 'initial !important',
		},
	}

	function fetchArxivInfo(matchinfo, event) {
		GM_xmlhttpRequest({
			method: 'GET',
			url: `https://export.arxiv.org/api/query?id_list=${matchinfo.id}`,
			onload: function(response) {
				const parser = new DOMParser();
				const xmlDoc = parser.parseFromString(response.responseText, "text/xml");
				const entry = xmlDoc.getElementsByTagName("entry")[0];
				const title = entry.getElementsByTagName("title")[0].textContent.trim();
				const published = new Date(entry.getElementsByTagName("published")[0].textContent);
				const authors = Array.from(entry.getElementsByTagName("author")).map(author => {
					const name = author.getElementsByTagName("name")[0].textContent;
					return `<a href="https://arxiv.org/search/?searchtype=author&query=${encodeURIComponent(name)}" target="_blank" rel="noopener noreferrer">${name}</a>`;
				}).join(', ');
				const summary = entry.getElementsByTagName("summary")[0].textContent.trim();
				const content = `
				<div class="preview-link-div" style="display: flex; justify-content: space-between;">
					<div>
						<strong><a href="${event.target.href}" class="preview-link-a" target="_blank" rel="noopener noreferrer">${title}</a></strong><br>
						<em>${authors}</em><br>
						<small>Published: ${published.toLocaleDateString("en-US", { year: 'numeric', month: 'long' })}</small>
					</div>
					<a href="${event.target.href.replace('/abs/', '/pdf/')}" target="_blank" rel="noopener noreferrer" style="padding-left:0.5em;padding-right:0.5em;"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/PDF_file_icon.svg/1200px-PDF_file_icon.svg.png" style="width: 20px; height: 20px;"></a>
				</div>
				<hr></hr>
				<div class="preview-content-div" style="max-height: 200px; overflow-y: auto; font-size: 13px; width: 100%; left: 0%; color: black;">
					<p style="width:100%; left:0%;">${summary}</p>
				</div>`;
				showPreview(event, content);
	}	});	}
	function fetchLessWrongInfo(matchinfo, event) {
		GM_xmlhttpRequest({
			method: "POST",
			url: "https://www.lesswrong.com/graphql",
			headers: ({ 'Content-Type': 'application/json' }),
			data: JSON.stringify(({ query: `{post(input:{selector:{_id:"${matchinfo.id}"}}) {result {htmlBody url title postedAt voteCount commentCount user {username slug}}}}`})),
			onload: function(res) {
				res = JSON.parse(res.response);
				res = res.data.post? res.data.post.result : undefined;
				const htmlBody = res.htmlBody.replace(/\n/g,"<br>");//.match(/<body>(.+)<\/body>/)[1];
				const content = `
				<div class="preview-link-div" style="display: flex; justify-content: space-between;">
					<div>
						<strong><a href="${event.target.href}" class="preview-link-a" target="_blank" rel="noopener noreferrer">${res.title}</a></strong><br>
						Posted ${res.postedAt.replace(/T.*/,"")} by <a href="https://lesswrong.com/users/${res.user.slug}">${res.user.username}</a> (karma: ${res.voteCount}, comments: ${res.commentCount}).
					</div>
				</div><hr></hr>
				<div class="preview-content-div" style="max-height: 200px; overflow-y: auto; font-size: 13px; width: 100%; left: 0%; color: black;">
					${htmlBody}
				</div>`;
				showPreview(event, content);
	}	});	}
	function fetchWikipediaInfo(matchinfo, event) {
		GM_xmlhttpRequest({
			method: 'GET',
			url: `https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts|redirects&format=json&explaintext&exintro&redirects=1&titles=${encodeURIComponent(matchinfo.title)}`,
			onload: function(response) {
				const responseJson = JSON.parse(response.responseText);
				const pages = responseJson.query.pages;
				const page = pages[Object.keys(pages)[0]];
				let pageTitle = page.title;
				let redirectString = ``;
				if((responseJson.query?.redirects || [false])[0]) {
					pageTitle = responseJson.query.redirects[0].from;
					redirectString = `<br><em>${responseJson.query.redirects[0].from}</em> redirects to <em>${responseJson.query.redirects[0].to}</em>`;
					if(responseJson.query.redirects[0]?.tofragment) {
						redirectString = redirectString+`#<em>${responseJson.query?.redirects[0].tofragment}</em>`;
				}}
				const content = `
				<div class="preview-link-div" style="display: flex; justify-content: space-between;">
					<strong><a href="${event.target.href}" class="preview-link-a" target="_blank" rel="noopener noreferrer">${pageTitle}</a></strong>${redirectString}
				</div><hr></hr>
				<div class="preview-content-div" style="max-height: 200px; overflow-y: auto; font-size: 13px; width: 100%; left: 0%; color: black;">
					<p style="width:100%; left:0%;">${page.extract}</p>
				</div>`;
				showPreview(event, content);
	}	});	}

	function fetchGithubInfo(matchinfo, event) {
		GM_xmlhttpRequest({
			method: 'GET',
			url: `https://api.github.com/repos/${matchinfo.owner}/${matchinfo.repo}`,
			onload: function(response) {
				const repo = JSON.parse(response.responseText);

				// Define additional repository details to display
				const repoDetails = (x=>x?`(${x}, `:`(`)([
					repo.private ? "Private" : "Public",
					repo.archived ? "Archived" : "",
					repo.disabled ? "Disabled" : ""
				].filter(x => x).join(", "));

				// Calculate the repository's age
				const createdAt = new Date(repo.created_at).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
				const lastPushed = new Date(repo.pushed_at).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });

				const repoName = repo.full_name.split('/')
				const repoLanguage = repo.language?repo.language:"(not given)";
				const content = `
					<div class="preview-link-div" style="display: flex; justify-content: space-between;">
						<div>
							<strong>
							<a href="${repo.owner.html_url}" class="preview-link-a" target="_blank" rel="noopener noreferrer">${repoName[0]}</a> ${repoName.length>1?'/':''}
							<a href="${event.target.href}" class="preview-link-a" target="_blank" rel="noopener noreferrer">${repoName.reverse()[0]}</a>
							</strong> ${repoDetails}${repoLanguage})<br>
							Stars: ${repo.stargazers_count}, Forks: ${repo.forks_count}<br>
							Created: ${createdAt}, Updated ${lastPushed}
						</div>
					</div>
					<hr></hr>
					<div class="preview-content-div" style="max-height: 200px; overflow-y: auto; font-size: 14px; width: 100%; left: 0%; color: black;">
						${repo.description}
					</div>`;
				showPreview(event, content);
			}
		});
	}

	const hoverDelay = 150; // how long (in ms) to wait before showing the preview
	const hideDelay = 500; // on mouse exit, how long before hiding
	let hoverTimeout, previewDiv, hideTimeout;

	function showPreview(event, content) {
		previewDiv.innerHTML = content;
		const windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		const windowHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
		const popupWidth = previewDiv.clientWidth + 15, popupHeight = previewDiv.clientHeight + 15;
		const maxPopupWidth = 600, maxPopupHeight = 400;

		previewDiv.style.left = (event.clientX + maxPopupWidth > windowWidth) ? `${windowWidth - maxPopupWidth + 15}px` : `${event.clientX + 15}px`;
		previewDiv.style.top = (event.clientY + maxPopupHeight > windowHeight) ? `${windowHeight - maxPopupHeight + 15}px` : `${event.clientY + 15}px`;
		previewDiv.style.display = 'block';

		previewDiv.onmouseenter = (() => {clearTimeout(hideTimeout); clearTimeout(hoverTimeout)});
		previewDiv.onmouseleave = (() => (hideTimeout = setTimeout(hidePreview, 600)));
	}

	function hidePreview() {
		previewDiv.style.display = 'none';
	}

	function onLinkMouseEnter(event) {
		const target = event.target;
		let match, matchInfo;
		for (let key in captures) {
			match = target.href.match(captures[key].regex);
			if (match) {
				// if current url is in the exceptions list, return
				let exceptions = (captures[key]?.exceptions ? captures[key].exceptions : ['.*']);
				if (exceptions.some((regex) => window.location.href.match(regex))) { return; }
				// zip the matched groups with their names
				matchInfo = Object.fromEntries(captures[key].groups.map((_, i) => [captures[key].groups[i], match[i + 1]]));
				hoverTimeout = setTimeout((() => captures[key].fetch(matchInfo, event)), hoverDelay);
				break;
	}   }   }

	function onLinkMouseLeave() {
		clearTimeout(hoverTimeout); clearTimeout(hideTimeout);
		hideTimeout = setTimeout(hidePreview, 600);
	}

	function observeDOMChanges() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.tagName === 'A') {
							node.addEventListener('mouseenter', onLinkMouseEnter);
							node.addEventListener('mouseleave', onLinkMouseLeave);
		}   }); }   }); });
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function attachEventListeners() {
		const links = document.getElementsByTagName("a");
		for (const link of links) {
			for (let key in captures) {
				if (link.href.match(captures[key]?.regex)) {
					console.log(key, captures[key], link.href, `<span style='color: ${captures[key].textColor}'>${captures[key].textContent}</span>`);
					link.removeEventListener('mouseenter', onLinkMouseEnter);
					link.removeEventListener('mouseleave', onLinkMouseLeave);
					link.addEventListener('mouseenter', onLinkMouseEnter);
					link.addEventListener('mouseleave', onLinkMouseLeave);
					//link.setHTMLUnsafe(link.outerHTML + `<sup style='color: ${captures[key].textColor}'>${captures[key].textContent}</sup>`);
				}
		}	}
   }

	function init() {
		const style = document.createElement('style');
		style.type='text/css';
		document.head.appendChild(style);
		const sheet = style.sheet;
		sheet.insertRule("div.preview-div *:not(em, a, b, strong, br, span), div.preview-div > div.preview-content-div p {left: 0%; width: 100%; text-align: initial !important;}");
		sheet.insertRule("div.preview-div > * > :is(p, li) {left: 0 !important; width: auto !important;}");
		sheet.insertRule("div.preview-div {color: black; position: fixed; zIndex: 10000; backgroundColor: white; border: 1px solid black; padding: 10px; maxWidth: 600px; maxHeight: 400px; overflowY: auto; display: none; borderRadius: 4px; transition: opacity 0.5s ease-in; textAlign: initial !important;}");
		sheet.insertRule("div.preview-content-div {max-height: 200px; overflow-y: auto; font-size: 13px; width: 100%; left: 0%; color: black;}");
		sheet.insertRule("div.preview-link-div {display: flex; justify-content: space-between;}");
		sheet.insertRule("div.preview-link-a {color: darkblue; font-weight: 600; font-size: 1.2em;}");
		sheet.insertRule("div.preview-div img {max-width: 80% !important;}");
		previewDiv = document.createElement('div');
		for (let key in styles['preview-div']) {
			previewDiv.style[key] = styles['preview-div'][key];
		}
		previewDiv.classList.add("preview-div");
		document.body.appendChild(previewDiv);

		attachEventListeners();
		setTimeout(attachEventListeners, 5000);
		observeDOMChanges();
	}
	init();
})();

