var Tools = require('./tools.jsx');
var trim = require('underscore.string/trim');
var _ = require('underscore');

/**
 * VariableEditor allows editing variable => value pairs, with an inline "add" and "remove"
 * capability. Variables need to be kept unique.
 */
var VariableEditor = React.createClass({
	getInitialState: function() {

		var model = Tools.deepCopyModel(this.props.model);
		model.push({
			variable: "",
			value: "",
			vacant: true
		});

		return {
			saving: false,
			model: model,
			valid: true,
			message: ""
		};
	},

	save: function(event) {
		event.stopPropagation();
		event.preventDefault();

		this.setState({saving: true});

		var assocArray = {};
		for (var i=0; i<this.state.model.length; i++) {
			if (!this.state.model[i].deleted) {
				assocArray[this.state.model[i].variable] = this.state.model[i].value;
			}
		}

		var self = this;
		Q($.ajax({
			type: "POST",
			url: this.props.context.envUrl + '/configuration/save',
			data: {
				variables: JSON.stringify(assocArray)
			}
		}))
			.then(function() {
				self.props.editingSuccessful(Tools.deepCopyModel(self.state.model));
			}, function(data){
				self.setState({
					saving: false,
					message: "Failed to save changes: " + data.responseText
				});
			});
	},

	/**
	 * Main model is represented by an array, kept in the state. Wrap rows in a proxy object
	 * so that we can manipulate on them as if they were individual items.
	 *
	 * @param int row Row index in the model array. If the index is past the end of the array, it's treated
	 *	as a new item that can be added into the model.
	 */
	rowStateProxy: function(row) {
		var self = this;

		var updateState = function() {
			self.setState({model: self.state.model});
		};

		var isVariableUnique = function(variable) {
			for (var i=0; i<self.state.model.length; i++) {
				if (row!=i
					&& !self.state.model[i].deleted
					&& self.state.model[i].variable===variable
				) return false;
			}
			return true;
		};

		return ({
			isVacant: function() {
				return (typeof self.state.model[row].vacant!=='undefined' && self.state.model[row].vacant);
			},
			setVariable: function(variable) {
				if (self.state.model[row].vacant) {
					self.state.model.push({
						variable: "",
						value: "",
						vacant: true
					});
				}

				self.state.model[row].variable = variable;
				self.state.model[row].vacant = false;
				updateState();
			},
			setValue: function(value) {
				self.state.model[row].value = value;
				updateState();
			},
			add: function(variable, value) {

				updateState();
			},
			remove: function() {
				self.state.model[row].deleted = true;
				updateState();
			},
			validateVariable: function(value) {
				if (trim(value)==="") {
					return "Variable cannot be empty.";
				}
				if (value.match(/[^a-zA-Z_0-9]/)) {
					return "Only alphanumerics and underscore permitted.";
				}
				if (value.match(/^[0-9]/)) {
					return "Variable cannot start with a digit.";
				}
				if (!isVariableUnique(value)) {
					return "Variable already exists.";
				}
				if (self.props.blacklist) {
					for (var i=0; i<self.props.blacklist.length; i++) {
						var re = new RegExp(self.props.blacklist[i]);
						if (value.match(re)) return "Variable is not allowed.";
					}
				}
			}
		});
	},

	handleValidationFail: function() {
		this.setState({valid: false});
	},

	handleValidationSuccess: function() {
		this.setState({valid: true});
	},

	render: function() {
		var self = this;
		var i = 0;
		var rows = _.map(this.state.model, function(item) {
			var row;
			if (!item.deleted) {
				// Rely on the positional number of the model row as the key. As rows are deleted,
				// the variables will get marked up with "deleted: true", but remain in the model
				// to ensure react knows what rows to changed.
				row = (
					<VariableEditorRow
						key={i}
						disabled={self.state.saving}
						variable={item.variable}
						value={item.value}
						validationFail={self.handleValidationFail}
						validationSuccess={self.handleValidationSuccess}
						rowState={self.rowStateProxy(i)} />
				);
			}
			i++;
			return row;
		});

		var message = null;
		if (this.state.message) {
			message = (
				<div className="alert alert-danger">{this.state.message}</div>
			)
		}

		return (
			<form className="variable-editor" onSubmit={this.save} >
				{message}
				<table className="table table-striped">
					<thead>
						<tr>
							<th className="variable">Variable</th>
							<th className="value">Value</th>
							<th className="actions">&nbsp;</th></tr>
					</thead>
					<tbody>
						{rows}
					</tbody>
				</table>
				<VariableEditorActions
					context={this.props.context}
					disabled={!this.state.valid}
					saving={this.state.saving}
					cancel={this.props.editingCancelled} />
			</form>
		);
	}
});

var VariableEditorActions = React.createClass({
	render: function() {
		if (!this.props.saving) {
			return (
				<div className="bottom-actions variable-editor-actions">
					<input type="submit" disabled={this.props.disabled} className="btn btn-primary" value="Save" />
					<button type="button" className="btn btn-default" onClick={this.props.cancel}>Cancel</button>
				</div>
			);
		} else {
			return (
				<div className="bottom-actions variable-editor-actions">
					<span>Saving...</span>
				</div>
			);
		}
	}
});

var VariableEditorRow = React.createClass({

	handleVariableChange: function(event) {
		this.props.rowState.setVariable(event.target.value);
	},

	handleValueChange: function(event) {
		this.props.rowState.setValue(event.target.value);
	},

	validateVariable: function(value) {
		return this.props.rowState.validateVariable(value);
	},

	render: function() {
		var remove = null;
		if (!this.props.rowState.isVacant()) {
			remove = (
					<button type="button" className="btn btn-danger btn-xs" onClick={this.props.rowState.remove} disabled={this.props.disabled}>Remove</button>
			);
		}
		return (
			<tr>
				<td>
					<ValidatableInput disabled={this.props.disabled} type="text" value={this.props.variable} onChange={this.handleVariableChange}
						validate={this.validateVariable} onValidationFail={this.props.validationFail} onValidationSuccess={this.props.validationSuccess} />
				</td>
				<td>
					<input disabled={this.props.disabled} type="text" value={this.props.value} onChange={this.handleValueChange} />
				</td>
				<td>
					{remove}
				</td>
			</tr>
		);
	}
});

/**
 * Input field with an ability to show an error message. Pass validate, onValidationFail and onValidationSuccess
 * callbacks to handle the error messaging.
 */
var ValidatableInput = React.createClass({
	getInitialState: function() {
		return {
			message: ""
		};
	},

	update: function(value) {
		var message = this.props.validate(value);
		this.setState({message: message});
		if (!message) {
			this.props.onValidationSuccess();
		} else {
			this.props.onValidationFail();
		}
	},

	handleChange: function(event) {
		this.update(event.target.value);
		if (this.props.onChange) {
			this.props.onChange(event);
		}
	},

	handleBlur: function(event) {
		this.update(event.target.value);
		if (this.props.onBlur) {
			this.props.onBlur(event)
		}
	},

	render: function() {
		return (
			<div>
				<input disabled={this.props.disabled} type={this.props.type} onChange={this.handleChange}
					onBlur={this.handleBlur} value={this.props.value} defaultValue={this.props.defaultValue} />
				<small className="error">{this.state.message}</small>
			</div>
		);
	}
});

module.exports = VariableEditor;
