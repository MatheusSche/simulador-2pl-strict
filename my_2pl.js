const scheduler = require('./Scheduler');

// -> História sem conflito
//const history = 'r1[x] r2[y] r1[y] c1 w2[x] c2';

// -> História com uma operação que foi pro delay
//const history = 'r1[x] w1[x] w2[x] c1 c2';

// -> História com DeadLock
//const history = 'r1[x] w2[y] r1[y] w2[x] c1 c2';

// -> História com operação que n pode ser executada
//const history = 'r1[x] r2[y] r1[y] c1 r1[x] w2[x] c2';

// -> História com mais de uma operação que precisa de delay
//const history = 'r1[x] w1[x] w2[x] r2[y] w2[y] c1 c2';
sc = new scheduler(history);
