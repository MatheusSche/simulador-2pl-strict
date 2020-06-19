const Operation = require('./models/Operation');
const Transaction = require('./models/Transaction');
const Lock = require('./models/Lock');

module.exports = class Scheduler {
  constructor(history) {
    this.operations = [];
    this.delayed_operations = [];
    this.transactions = new Map();
    this.locks = [];
    this.execution_list = [];
    this.final_history = [];
    this.counter = 0;

    this.parse_history(history);

    console.log(`Historia original -> ${history}`);

    this.run_operations()

  }
  
  parse_history(history) {
    const subtrings = history.split(' ');
    const regExp_commit = new RegExp('c([0-9])');
    const regExp_read = new RegExp('r([0-9])\\[([a-z])\\]');
    const regExp_write = new RegExp('w([0-9])\\[([a-z])\\]');

    for (const substring of subtrings) {  
      let sre_match = null;
      // Testa operação de read
      if (regExp_read.test(substring)){
        sre_match = substring.match(regExp_read);
        this.operations.push(new Operation(sre_match[1], 'r', sre_match[2]));
          
      // Testa operação de write
      } else if (regExp_write.test(substring)){
        sre_match = substring.match(regExp_write);
        this.operations.push(new Operation(sre_match[1], 'w', sre_match[2]));
      
      // Testa operação de commit
      } else if (regExp_commit.test(substring)){
        sre_match = substring.match(regExp_commit);
        this.operations.push(new Operation(sre_match[1], 'c', null));
      
      } else {
        throw 'Enntrada Inválida';
      }

      if(!(this.transactions.has(sre_match[1]))){
        this.transactions.set(sre_match[1], new Transaction(sre_match[1]));
      }
      
    }

  }

  has_delayed_operation(transaction){
    for(const operation of this.delayed_operations){
      if(operation.transaction == transaction) {
        return true;
      }
    }
    return false;

  }

  can_grow_transaction(transaction_value){
    return this.transactions.get(transaction_value).is_growing;
  }

  has_lock(operation){
    for( const lock of this.locks){
      
      if(
        lock.resource == operation.resource &&
        lock.transaction == operation.transaction &&
        ((lock.exclusive && operation.action == 'w')|| (!lock.exclusive && operation.action == 'r'))
        ){
          return true
        } 
    }
    return false;
  }

  can_lock(operation){
    const relevant_locks = [];
    for( const lock of this.locks ){
      if( lock.resource == operation.resource){
        relevant_locks.push(lock);
      }
    }

    for( const lock of relevant_locks){
      if( !(lock.exclusive) ){
        if( lock.transaction == operation.transaction && relevant_locks.length==1 && operation.action == 'w'){
          return true;
        } else if ( lock.transaction != operation.transaction && operation.action == 'r'){
          return true;
        }
      }
      return false;
    }
    return true;
  }

  add_lock(operation){
    const exclusive = operation.action=='w'?true:false;
   
    const lock = new Lock(operation.transaction, exclusive, operation.resource);
    this.locks.push(lock);
    this.final_history.push(lock);
  }

  can_commit(transaction){
    const pending_operations = [];

    for (const operation of this.delayed_operations){
      if( operation.transaction == transaction){
        pending_operations.push(operation);
      }
    }
    
    if ( pending_operations.length == 0){
      return true;
    }

    return  false;
  }

  diferenca(setA, setB) {
    var _diferenca = new Set(setA);
    for (var elem of setB) {
        _diferenca.delete(elem);
    }
    return _diferenca;
  }
  
  release_locks(transaction){
    const original_locks = this.locks.slice();
    this.locks.splice(0, Number.MAX_VALUE);
    for( const lock of this.locks ){
      if( !(lock.transaction == transaction) ){
        this.locks.push(lock);
      }
    }
    
    for( const released_lock of this.diferenca(original_locks, new Set(this.locks))){
      const lock = new Lock(released_lock.transaction, released_lock.exclusive, released_lock.resource, true);
      this.final_history.push(lock);
    }

  }

  run_operation(operation){
    if( operation.is_write() || operation.is_read() ){
      
      if( this.can_grow_transaction(operation.transaction)){
        
        if( this.has_lock(operation)){
          this.final_history.push(operation);
        } else if ( this.can_lock(operation) ){
          this.add_lock(operation);
          this.final_history.push(operation);
        } else {
          return operation;
        }
      } else {
        const msg = `Operação ${operation.format_as_history()} ignorada pois a transação está na fase de shrinking`;
        console.log(msg);
      }
    
    } else if (operation.is_commit()){
      if ( this.can_commit(operation.transaction)){
        this.final_history.push(operation);
        this.release_locks(operation.transaction);
        const transaction_ref = this.transactions.get(operation.transaction); 
        transaction_ref.is_growing = false;
      
        //this.transactions[operation.transaction].is_growing = false;
      } else {
        const msg = `Não é possível commitar a transação ${operation.transaction} pois existem operações pendentes`;
        console.log(msg);
      }
    } 
  }

  has_deadlock(){
    const conflicts = [];

    for( const delayed_operation of this.delayed_operations ){
      
      for( const lock of this.locks){
        if( delayed_operation.transaction != lock.transaction && delayed_operation.resource == lock.resource){
          conflicts.push([delayed_operation.transaction, lock.transaction]);
        }
      
      }
    }

    const conflicts_copy = conflicts.slice();
    for( const conflict of conflicts){
      for( const conf_copy of conflicts_copy){
       
        if( conflict[0] == conf_copy[1] && conflict[1]==conf_copy[0]){
          return conflict;
        }
      }
    }

    return false;

  }

  abort_transaction(transaction){
    const delayed_operations_copy = this.delayed_operations.slice();
    this.delayed_operations.splice(0, Number.MAX_VALUE);
    
    for( const deleyed_operation of delayed_operations_copy){
      if( !(deleyed_operation.transaction == transaction)){
        this.delayed_operations.push(deleyed_operation);
      }
    }

    const final_history_copy = this.final_history.slice();
    this.final_history.splice(0, Number.MAX_VALUE);
    

    for( const item of final_history_copy){
      if( !(item.transaction == transaction)){
        this.final_history.push(item);
      }
    }

    const locks_copy = this.locks.slice();
    this.locks.splice(0, Number.MAX_VALUE);

    for( const lock of locks_copy ){
      if( !(lock.transaction == transaction)){
        this.locks.push(lock);
      }
    }

    let counter_decrementer = 0;

    for( const [index, operation] of this.execution_list.entries() ){
      if( operation.transaction == transaction && index <= this.counter){
        counter_decrementer += 1;
      }
    }

    const execution_list_copy = this.execution_list.slice();
    this.execution_list.splice(0, Number.MAX_VALUE);
    
    for( const operation of execution_list_copy ){
      if( !(operation.transaction == transaction) ){
        this.execution_list.push(operation);
      }
    }

    this.counter -= counter_decrementer;
    for( const operation of this.operations ){
      if(operation.transaction == transaction){
        this.execution_list.push(operation);
      }
    }

    console.log(`DeadLock encontrado: a transação ${transaction} foi abortada`);

  }

  run_delayed_operations(){
    if( this.delayed_operations ){
      const redelayed_operations = [];
      
      for( const delayed_operation of this.delayed_operations ){
        
        const redelayed_operation = this.run_operation(delayed_operation);
        if(redelayed_operation){
          redelayed_operations.push(redelayed_operation);
        }
      }

      this.delayed_operations = redelayed_operations.slice();
    }
  }

  print_final(){
    let operations_text = '';

    for( const item of this.final_history){
      if( item instanceof Operation || item instanceof Lock){
        operations_text += `${item.format_as_history()}, `;
      }
    }
    if( operations_text ){
      console.log(`História Final: ${operations_text.trim(', ')}`);
    }
  }

  run_operations(){
    this.execution_list = this.operations.slice();
   
    while(this.counter < this.execution_list.length){
      
      if(this.has_delayed_operation(this.execution_list[this.counter].transaction)){
        this.delayed_operations.push(this.execution_list[this.counter]);
        console.log(`A operacao ${this.execution_list[this.counter].format_as_history()} foi delayedddd`);
      
      } else {
        
        const operation = this.run_operation(this.execution_list[this.counter]);
        
        
        if(operation){
          this.delayed_operations.push(operation);
          console.log(`A operacao ${operation.format_as_history()} foi delayed`);

          const deadlock = this.has_deadlock();
          
          if ( deadlock ){
            this.abort_transaction(operation.transaction);
          }

        }

        this.run_delayed_operations();
      
      } 

      this.counter += 1;
      if( this.counter == this.execution_list.length){
        for( const delayed_operation of this.delayed_operations){
          this.execution_list.push(delayed_operation);
        }
        this.delayed_operations = []
      }

    }

    this.print_final();
  }

}
