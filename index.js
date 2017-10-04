const Papa = require("./papaparse.js");
const datetime = require('node-datetime');
const prompt = require('prompt');
const fs = require('fs');
const testFolder = './csvs'

var option = 0;

const menu = [];
console.log('\033[2J');
console.log(`
+-----------------------------------------+
THIS IS A PAIN IN MY ASS
+-----------------------------------------+

`)

//gets files in ./csvs and ignores anything that does not end with .csv
fs.readdirSync(testFolder).forEach(file  => {
  if ( /.*csv/.test(file)){
    menu[option-1] = {option , file}
  }
  option++;
})
console.log(menu)

prompt.start()

prompt.get(['selection','windowLength'], function(err, result) {

  console.log(`
you chose ${menu[result.selection-1].file} with ${result.windowLength} hour windows!

+-----------------------------------------+
`);

  var file = `./csvs/${menu[result.selection-1].file}`;
  const windowLength = parseInt(result.windowLength);


  var content = fs.readFileSync(file, { encoding: 'binary' });
  const novCsv = Papa.parse(content, {
      header: true,
  }).data;

  Array.prototype.contains = function (v) {
      for(var i = 0; i < this.length; i++) {
          if(this[i] === v) return true;
      }
      return false;
  };

  Array.prototype.unique = function() {
      var arr = [];
      for(var i = 0; i < this.length; i++) {
          if(!arr.contains(this[i])) {
              arr.push(this[i]);
          }
      }
      return arr;
  }

  //figures out if weekend (weekend mornings have different guarantee amounts)
  const isWeekend = (day) => {
    return day.getDay() === 6 || day.getDay() === 0;
  }

  //list of unique drivers (duh)
  const uniqueDrivers = novCsv.map(task => {
    return task.workerName;
  }).unique()

  //builds driver object
  const data = uniqueDrivers.map(driver => {
    return {'name': driver, 'day': []}
  })

  var workerMonthTotal = []
  //iterate drivers
  for ( let i = 0; i < data.length-1; i++ ) {
    workerMonthTotal[i] = {'name': data[i].name, 'count': 0};

    data[i].whatWeOwe = 0;
    //iterate days
    for ( let j = 0; j <= 30; j++ ) {
      var whatWePaid = 0;
      var whatWeOwe = 0;
      var guarantee = 0;
      var commission = 0;

      data[i].day[j]={'day': j+1,'wave': []}

      //init daily properties
      data[i].day[j].dailyTotalJobs = 0;
      data[i].day[j].dayGuarantee = 0;
      data[i].day[j].whatWeShouldPay = 0

      //iterate delivery windows
      for ( let k = 9; k < 21; k += windowLength ){

        var count = 0;

        for ( let l = 0; l < novCsv.length; l++ ){

          const taskWindow = new Date( novCsv[l].completeAfterTime ).getHours();
          const taskDay = new Date( novCsv[l].completionTime );
          const taskWorker = novCsv[l].workerName;

          if (  taskDay.getDate() === j+1 &&
                taskWorker === data[i].name &&
                taskWindow >= k &&
                taskWindow < k + windowLength ){
            count++;
            if ( isWeekend(taskDay) ){
              data[i].day[j].weekend = true;
            }
          }
        }

        data[i].day[j].wave[k] = { count, guarantee };
        data[i].day[j].dailyTotalJobs += count;

        workerMonthTotal[i].count += count;

        if ( parseInt( data[i].day[j].wave[k].count ) > 0 ){
          if (( data[i].day[j].weekend && k === 9 ) || k === 21-windowLength ){
            data[i].day[j].wave[k].guarantee = ( 20 * windowLength )
            data[i].day[j].dayGuarantee += ( 20 * windowLength )
          } else {
            data[i].day[j].wave[k].guarantee = ( 15 * windowLength )
            data[i].day[j].dayGuarantee += ( 15 * windowLength )
          }
        }

        if (( data[i].day[j].wave[k].count * 8 ) > data[i].day[j].wave[k].guarantee ){
          data[i].day[j].whatWeShouldPay += data[i].day[j].wave[k].count*8
        } else {
          data[i].day[j].whatWeShouldPay += data[i].day[j].wave[k].guarantee
        }
      }

      if (( data[i].day[j].dailyTotalJobs ) * 8 > data[i].day[j].dayGuarantee ){
        data[i].day[j].whatWePaid = ( data[i].day[j].dailyTotalJobs )*8
      } else {
        data[i].day[j].whatWePaid = data[i].day[j].dayGuarantee
      }
    data[i].whatWeOwe += data[i].day[j].whatWeShouldPay - data[i].day[j].whatWePaid;
    }
  console.log ( `${data[i].name}: owed \$${data[i].whatWeOwe}
(if feb apr or may ignore days around holidays)
---------------------
day:  did pay\t-   should pay \t-\towe` )
  for(let m = 0; m < 31; m++){
    console.log(`${m+1}:\t$${data[i].day[m].whatWePaid}\t-\t$${data[i].day[m].whatWeShouldPay}\t-\t$${data[i].day[m].whatWeShouldPay-data[i].day[m].whatWePaid}`)
  }
  console.log('\n')
  }
})
