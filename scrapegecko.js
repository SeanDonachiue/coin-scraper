import axios from "axios"
import cheerio from "cheerio"
import puppeteer from "puppeteer"

const geckoUrl = 'https://www.coingecko.com/en/coins/';
const api = 'http://localhost:3000/api'; //TODO SWITCH THIS TO THE HOSTED BACKEND
//Given a coingecko token page url, scrape exchange orderbook depth information
//https://coingecko.com/en/coins/<name>#markets

//looking for a way to filter exchanges for fake volume data or spoof quotes

//table entries with usd or stablecoin trading pairs, 24hr volume greater than $5m
//$(selector, [context], [root])


//TODO sum data
//parsefloats and remove commas first

async function scrapeToken(url) {

	//might want to pull this initialization step to a higher execution context
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url);
	console.log(page.url());
	//console.log(await page.$eval("body", el => el.innerHTML));
	
	//click and wait for pageload from https://github.com/puppeteer/puppeteer/blob/v14.1.1/docs/api.md#puppeteerconnectoptions
	const options = {
		'waitUntil' : 'networkidle0'
	}
	let [response] = await Promise.all([
  		page.waitForNavigation(options),
  		page.click('a[href="#markets"]') //need to wait for a while here I guess
	]);
	console.log(page.url());
	let html = await page.$eval("body", el => el.innerHTML); //works

	//want to click 24h volume to sort exchanges by relevance before redoing this call I guess?

	//try navigating to it using cheerio to like... get the element that is going to match, i guess, or maybe need to use MDN queryselector idk.
	//page.click('')
	//hopefully can use cheerio to extract values from here
	let $ = cheerio.load(html);
	//gecko-table.table (ie getting close to the data here)

	//Load the full data table (sponsored and unsponsored rows split in separate tbody elems)
	let table = cheerio.load($('div#markets').children().first().children().first().next().children().first().children().first().children().first().next().html(), null, false);
	
	let name = url.substring(35, url.length);

	let obsArray = new Array();

	let exch, pair, price, obup, obdown, vol;

	//take a timestamp observation before processing everything so data is not sparsely populated across timestamps
	const timestamp = new Date().toISOString();
	let obupSum = 0;
	let obdownSum = 0;
	let volSum = 0;
	let tokenName = url.substring(geckoUrl.length);

	const sponsoredRows = table('tbody:nth-of-type(1) tr');
	sponsoredRows.each((i, el) => {
		const num = $('td:nth-of-type(1)', el).text();
		//console.log("row number pulled from table: " + num);
		exch = $('td:nth-of-type(2)', el).children('div').find('a').text();
		exch = exch.substring(exch.length/2, exch.length)
		pair = $('td:nth-of-type(3)', el).children().first().text();
		price = $('td:nth-of-type(4)', el).children().first().text();
		obup = $('td:nth-of-type(6)', el).text();
		obdown = $('td:nth-of-type(7)', el).text();
		vol = $('td:nth-of-type(8)', el).children().first().text();

		//Clean up formatting
		price = price.substring(1, price.length);
		obup = obup.substring(2, obup.length);
		obdown = obdown.substring(2, obdown.length);
		vol = vol.substring(1, vol.length);
		let strings = removeNewline([name, exch, pair, price, obup, obdown, vol]);
		//console.log(strings);
		let observation = {
			token: strings[0],
			exchange: strings[1],
			pair: strings[2],
  			stamp: timestamp,
  			price: strings[3],
  			obup: strings[4],
  			obdown: strings[5],
  			volume: strings[6]
		};
		if(observation.pair.includes("USD")) {
			obsArray.push(observation);
			obupSum += parseFloat(observation.obup.replace(/,/g, ''));
			obdownSum += parseFloat(observation.obdown.replace(/,/g, ''));
			volSum += parseFloat(observation.volume.replace(/,/g, ''));
		}
	});

	const rows = table('tbody:nth-of-type(2) tr');
	rows.each((i, el) => {
		const num = $('td:nth-of-type(1)', el).text();
		//console.log("row number pulled from table: " + num);
		exch = $('td:nth-of-type(2)', el).children('div').find('a').text();
		pair = $('td:nth-of-type(3)', el).children().first().text();
		price = $('td:nth-of-type(4)', el).children().first().text();
		obup = $('td:nth-of-type(6)', el).text();
		obdown = $('td:nth-of-type(7)', el).text();
		vol = $('td:nth-of-type(8)', el).children().first().text();

		//Clean up formatting
		price = price.substring(1, price.length);
		obup = obup.substring(2, obup.length);
		obdown = obdown.substring(2, obdown.length);
		vol = vol.substring(1, vol.length);
		let strings = removeNewline([name, exch, pair, price, obup, obdown, vol]);
		//console.log(strings);

		let observation = {
			token: strings[0],
			exchange: strings[1],
			pair: strings[2],
  		stamp: timestamp,
  		price: strings[3],
  		obup: strings[4],
  		obdown:strings[5],
  		volume: strings[6]
		};
		if(observation.pair.includes("USD")) {
			obsArray.push(observation);
			obupSum += parseFloat(observation.obup.replace(/,/g, ''));
			obdownSum += parseFloat(observation.obdown.replace(/,/g, ''));
			volSum += parseFloat(observation.volume.replace(/,/g, ''));
		}
	});

	obsArray = JSON.stringify(obsArray);
	console.log(obsArray);
	let aggregatedObs = {
		token: tokenName,
		stamp: timestamp,
		price: parseFloat(price.replace(/,/g, '')),
		obup: obupSum,
		obdown: obdownSum,
		volume: volSum
	};
	aggregatedObs = JSON.stringify(aggregatedObs);
	if(obsArray.length != 0) {
		axios({
			method: 'post',
			url: api + '/addObservations',
			data: {"data": obsArray}
		}).then(res => {
			console.log(res);
			axios({
			method: 'post',
			url: api + '/addAggregatedStamps',
			data: {"data": aggregatedObs}
			}).then(res => {
			console.log(res)
			});
		});

		//send another one to post aggregated data
		

	}
	await browser.close();
}



//call serverside api to insert instances of tokenModel to mongoDB Atlas cluster0
function insertToDB() {

}
//run it here
//scrapeToken('https://www.coingecko.com/en/coins/ethereum');

function isPromise(p) {
  if (typeof p === 'object' && typeof p.then === 'function') {
    return true;
  }

  return false;
}

function removeNewline (strings) {
	for(let i = 0; i < strings.length; i++) {
		strings[i] = strings[i].replace(/(\r\n|\n|\r)/gm, "");
	}
	return strings;
}


//blocks execution in calling function for "ms"
//call by "await" sleep
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

//holds a list of tokens to maintain data for
//call scrapeToken for each token in the list cyclically
//to be ran as a background process or


//@param tokenList - list of tokens to scrape and store data for
//@param t - time interval in ms to wait between scrapes
function scrapeController(tokenList) {
	console.log("started scrapecontroller function");
		for(let i = 0; i < tokenList.length; i++) {
			console.log("in the for loop");
			scrapeToken(geckoUrl + tokenList[i]);
		}	
}




const list = ["ethereum", "bitcoin", "solana"];
const hour = 3600000;
const five = 300000;
//run it here
//setInterval((list)=>scrapeController, 10000);
setInterval(() => scrapeController(list), five);
