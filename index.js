const Papa = require('papaparse');
const prompt = require('prompt');
const fs = require('fs');
const testFolder = './csvs';

var option = 0;
const dollarsPerDelivery = 8;
const lowerDollersPerHour = 15;
const higherDollersPerHour = 20;
const nineAM = 9;
const ninePM = 21;

const menu = [];
//console.log('\033[2J');
console.log(`
+-----------------------------------------+
THIS IS A PAIN IN MY ASS
+-----------------------------------------+

`);

//gets files in ./csvs and ignores anything that does not end with .csv
fs.readdirSync(testFolder).forEach(file  => {
  if ( /.*csv/.test(file)){
    menu[option-1] = {option , file};
  }
  option++;
});
console.log(menu);

prompt.start();

prompt.get(['selection','windowLength'], function(err, result) {

  console.log(`
you chose ${menu[result.selection-1].file} with ${result.windowLength} hour windows!

+-----------------------------------------+
`);

  const file = `./csvs/${menu[result.selection-1].file}`;
  const windowLength = parseInt(result.windowLength);

  const content = fs.readFileSync(file, { encoding: 'binary' });
  const parsedCsv = Papa.parse(content, {
      header: true,
  }).data;

  //figures out if weekend (weekend mornings have different guarantee amounts)
  const isWeekend = (day) => {
    return day.getDay() === 6 || day.getDay() === 0;
  };

  //list of unique drivers (duh)
  const uniqueDrivers = new Set();
  parsedCsv.map(task => {
    uniqueDrivers.add(task.workerName);
  });

  //populate month array fxn
  const fillArrayWithNumbers = n => {
    const arr = Array.apply(null, Array(n));
    return arr.map((x, i) => {
      return i;
    });
  };

  //populate delivery window array fxn
  const fillDeliveryWindows = window => {
    const arr = Array.apply(null, Array(4));
    return arr.map((x, i) => {
      if (i * window + nineAM < ninePM){
        return i * window + nineAM;
      }
    });
  };

  const deliveryWindows = fillDeliveryWindows(windowLength);


  //builds driver object
  const data = [...uniqueDrivers].map(driver => {
    return {'name': driver, 'day': fillArrayWithNumbers(31)};
  });

  //iterate drivers
  data.map(driver => {

    const month = fillArrayWithNumbers(31);
    driver.whatWeOwe = 0;
    //iterate days
    month.map(day => {

      driver.day[day]={'day': day+1,'wave': []};

      //init daily properties
      driver.day[day].dailyTotalJobs = 0;
      driver.day[day].dayGuarantee = 0;
      driver.day[day].whatWeShouldPay = 0;

      //iterate delivery windows
      deliveryWindows.map(window => {

        var count = 0;

        //iterate through each task in csv
        parsedCsv.map(task => {

          const taskWindow = new Date( task.completeAfterTime ).getHours();
          const taskDay = new Date( task.completionTime );
          const taskWorker = task.workerName;

          //if task in day && correct driver && in the correct window, then increment
          if (  taskDay.getDate() === day+1 &&
                taskWorker === driver.name &&
                taskWindow >= window &&
                taskWindow < window + windowLength ){
            count++;

            //checks if day is sat or sun for different morning guarantee
            if ( isWeekend(taskDay) ){
              driver.day[day].weekend = true;
            }
          }
        });

        driver.day[day].wave[window] = { count, guarantee: 0 };
        driver.day[day].dailyTotalJobs += count;

        //if driver worked today
        if ( parseInt( driver.day[day].wave[window].count ) > 0 ){
          //if (its the weekend AND the morning window) or the night window, guarantee is $20/hr
          if (( driver.day[day].weekend && window === nineAM ) || window === ninePM-windowLength ){
            //adds guaratee for just the window for discrepency pay
            driver.day[day].wave[window].guarantee = ( higherDollersPerHour * windowLength );
            //adds guarantee to entire day for what was actually paid
            driver.day[day].dayGuarantee += ( higherDollersPerHour * windowLength );
            //else $15/hr
          } else {
            driver.day[day].wave[window].guarantee = ( lowerDollersPerHour * windowLength );
            driver.day[day].dayGuarantee += ( lowerDollersPerHour * windowLength );
          }
        }
        //if $8/delivery IN A WINDOW is greater than hourly rate FOR JUST THAT WINDOW (discrepency pay)
        if (( driver.day[day].wave[window].count * dollarsPerDelivery ) > driver.day[day].wave[window].guarantee ){
          //we should pay $8/delivery for that window
          driver.day[day].whatWeShouldPay += driver.day[day].wave[window].count*dollarsPerDelivery;
        } else {
          //else hourly for that window
          driver.day[day].whatWeShouldPay += driver.day[day].wave[window].guarantee;
        }
      });
      //if $8 per delivery at end of the day is greater than sum of hourly guarantees (what was actually paid)
      if (( driver.day[day].dailyTotalJobs ) * dollarsPerDelivery > driver.day[day].dayGuarantee ){
        //they were paid $8/delivery
        driver.day[day].whatWePaid = ( driver.day[day].dailyTotalJobs )*dollarsPerDelivery;
      } else {
        //else they were paid hourly minimum for the whole day
        driver.day[day].whatWePaid = driver.day[day].dayGuarantee;
      }
    //what we owe = what we shouldve paid minus what we did pay(duh)
    driver.whatWeOwe += driver.day[day].whatWeShouldPay - driver.day[day].whatWePaid;
  });
    if (driver.whatWeOwe){
      console.log ( `${driver.name}: owed $${driver.whatWeOwe}
(if feb apr or may ignore days around holidays)
---------------------
day:  did pay\t-   should pay \t-\towe` );
      month.map(day => {
        console.log(`${ day+1 }: \t$${ driver.day[day].whatWePaid }\t-\t$${ driver.day[day].whatWeShouldPay }\t-\t$${ driver.day[day].whatWeShouldPay-driver.day[day].whatWePaid }`);
      });
      console.log('\n');
    }
  });
});
