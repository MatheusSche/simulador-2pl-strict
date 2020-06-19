module.exports = class Operation {
  constructor(transaction, action, resource) {
    this.transaction = transaction;
    this.action = action;
    this.resource = resource;

  }

  format_str(){
    return `Operacao - ${this.transaction} - ${this.action} - ${this.resource}`; 
  }

  format_as_history(delayed=false){
    const delayment_string = delayed?'Delayed':'';

    if(!this.resource){
      return `${this.action}${this.transaction}`
    }

    return `${delayment_string}${this.action}${this.transaction}[${this.resource}]`;
  }

  is_write(){
    return this.action === 'w';
  }

  is_read(){
    return this.action === 'r';
  }

  is_commit(){
    return this.action === 'c';
  }

}