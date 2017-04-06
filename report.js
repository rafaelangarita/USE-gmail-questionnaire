var fs = require('fs');
var futures = require('futures');
var sequence = futures.sequence();
var clone = require('clone');

function readFiles(dirname, onFileContent, onFinish, onError) {
    fs.readdir(dirname, (err, filenames) => {
        if (err) {
            onError(err);
            return;
        }
        var data = [];
        var itemsProcessed = 0;
        filenames.forEach((filename) => {
            fs.readFile(dirname + filename, 'utf-8', (err, content) => {

                itemsProcessed++;
                var questionsBody = content.substring(content.indexOf('q1='), content.length);
                var questionnaire = {
                    name: filename
                };

                questionnaire.answers = questionsBody.split('\r\n').filter((s) => {
                    return s[0] === 'q'
                }).map((s) => {
                    return {
                        name: s.split('=')[0],
                        value: s.split('=')[1]
                    };
                });
                data.push(questionnaire);
                if (itemsProcessed === filenames.length) {
                    process(data);
                }
            });
        });
    });
}


function process(data) {
    var n = Object.keys(data).length;
    console.log('Number of questionnaires: %s', n);
    var results = [];
    //for each question, how many users chose each option
    var choices = [];
    data.forEach(q => {
        q.answers.forEach(a => {
            //sum
            if (a.value != -1) {
                var found = results.some(function(id) {
                    return id.name === a.name;
                });
                if (found) {
                    var r = results.filter(x => x.name === a.name)[0];
                    r.value += parseInt(a.value);
                } else {
                    results.push({
                        name: a.name,
                        value: parseInt(a.value)
                    });

                }
            }
            //choices
            found = choices.some(function(id) {
                return id.name === a.name;
            });
            if (found) {
                var r = choices.filter(x => x.name === a.name)[0];
                var q = r.ranks.filter(x => x.rank === (a.value === '-1' ? 'NA' : a.value))[0];
                if (q != undefined) {
                    q.value += 1;
                } else {
                    r.ranks.push({
                        rank: a.value === '-1' ? 'NA' : a.value,
                        value: 1
                    });
                }

            } else {
                choices.push({
                    name: a.name,
                    ranks: [{
                        rank: a.value === '-1' ? 'NA' : a.value,
                        value: 1
                    }]
                });
            }
        });
    });


    var avg = clone(results);
    avg.forEach(r => {
        r.value = r.value / parseInt(n);
    });

    print('sum', results);

    print('average', avg);

    printChoices(mapChoices(choices, n));
}

function print(title, results) {
    console.log('*********************')
    console.log('List: %s', title);
    console.log('*********************')
    results.forEach(x => console.log(x.name + ':' + x.value));
}

function printChoices(c) {
    console.log('*********************')
    console.log('Percentages');
    console.log('*********************')
    c.forEach(x =>
        console.log(x.name + ': ' +
            'disagree = ' + x.ranks.filter(r => r.rank === 'disagree').map(r => r.value) + " ; " +
            'neutral = ' + x.ranks.filter(r => r.rank === 'neutral').map(r => r.value) + " ; " +
            'agree = ' + x.ranks.filter(r => r.rank === 'agree').map(r => r.value) + " ; " +
            'na = ' + x.ranks.filter(r => r.rank === 'na').map(r => r.value) + " ; "
        ));
}

function mapChoices(choices, n) {
    //choices: 1 2 3 4 5 6 7 NA null
    var disagree = ['1', '2', '3'];
    var neutral = ['4'];
    var agree = ['5', '6', '7'];
    var na = ['NA'];

    var map = [];
    choices.forEach(
        //sum of users within ranges
        x => {
            insertIntoMap(map, x.name, 'agree', (sum(agree, x) / n) * 100);
            insertIntoMap(map, x.name, 'disagree', (sum(disagree, x) / n) * 100);
            insertIntoMap(map, x.name, 'neutral', (sum(neutral, x) / n) * 100);
            insertIntoMap(map, x.name, 'na', (sum(na, x) / n) * 100);
        });
    return map;
}

function sum(choices, answer) {
    return answer.ranks.filter(r => choices.includes(r.rank))
        .map(x => x.value).reduce((a, b) => a + b, 0);
}

function insertIntoMap(map, name, rank, value) {

    var q = map.filter(x => x.name === name)[0];
    if (q != undefined) {
        var r = q.ranks.filter(x => q.rank === rank)[0];
        if (r != undefined) {
            r.value = value;
        } else {
            q.ranks.push({
                rank: rank,
                value: value
            })
        }
    } else {
        map.push({
            name: name,
            ranks: [{
                rank: rank,
                value: value
            }]
        });
    }

}

/**
 * Main
 */

readFiles('./questionnaires/', (filename, content) => {
    data[filename] = content;
}, process, (err) => {
    throw err;
});
