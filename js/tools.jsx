
module.exports = {
	readInlineData: function readInlineData(id) {
		var dataElement = document.getElementById(id);
		var dataText = dataElement.textContent || dataElement.innerText;
		var decodeElement = document.createElement("textarea");
		decodeElement.innerHTML = dataText;
		return JSON.parse(decodeElement.value);
	}
}
